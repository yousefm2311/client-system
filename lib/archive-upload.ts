type ArchiveUploadError = Error & {
  status?: number;
  code?: string;
  attempts?: number;
};

type UploadAttemptCallback = (attempt: number, maxAttempts: number) => void;

type UploadOptions = {
  clientCode: string;
  formData: FormData;
  maxRetries?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  defaultErrorMessage?: string;
  timeoutMs?: number;
  timeoutMessage?: string;
  onAttempt?: UploadAttemptCallback;
};

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const NON_RETRYABLE_CODES = new Set([
  "INVALID_FILE_TYPE",
  "UPLOAD_LIMIT",
  "VALIDATION_ERROR",
  "INVALID_CLIENT_ID",
]);

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const parseErrorPayload = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return { message: "", code: "" };
  }
  const data = payload as Record<string, unknown>;
  const errorObj = data.error as Record<string, unknown> | undefined;
  const message =
    (typeof data.message === "string" ? data.message : "") ||
    (typeof errorObj?.message === "string" ? errorObj.message : "");
  const code =
    (typeof data.code === "string" ? data.code : "") ||
    (typeof errorObj?.code === "string" ? errorObj.code : "");
  return { message, code };
};

const buildError = (message: string, details: Partial<ArchiveUploadError>) =>
  Object.assign(new Error(message), details) as ArchiveUploadError;

const DEFAULT_TIMEOUT_MS = Number(
  process.env.NEXT_PUBLIC_ARCHIVE_UPLOAD_TIMEOUT_MS ?? 30000
);

export async function uploadArchiveWithRetry({
  clientCode,
  formData,
  maxRetries = 2,
  minDelayMs = 700,
  maxDelayMs = 3000,
  defaultErrorMessage = "Archive upload failed.",
  timeoutMs,
  timeoutMessage,
  onAttempt,
}: UploadOptions) {
  const maxAttempts = Math.max(1, maxRetries + 1);
  let attempt = 0;
  let lastError: ArchiveUploadError = buildError(defaultErrorMessage, {});
  const requestTimeoutMs = Number.isFinite(timeoutMs)
    ? (timeoutMs as number)
    : DEFAULT_TIMEOUT_MS;
  const resolvedTimeoutMessage = timeoutMessage || defaultErrorMessage;

  while (attempt < maxAttempts) {
    attempt += 1;
    onAttempt?.(attempt, maxAttempts);

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    try {
      if (requestTimeoutMs > 0) {
        controller = new AbortController();
        timeoutId = setTimeout(() => controller?.abort(), requestTimeoutMs);
      }
      const res = await fetch(
        `/api/archives/upload?clientCode=${encodeURIComponent(clientCode)}`,
        { method: "POST", body: formData, signal: controller?.signal },
      );
      if (timeoutId) clearTimeout(timeoutId);
      const data =
        (await res.json().catch(async () => {
          try {
            const text = await res.text();
            return { raw: text };
          } catch {
            return {};
          }
        })) || {};

      if (res.ok) {
        return { data, attempts: attempt };
      }

      const { message, code } = parseErrorPayload(data);
      lastError = buildError(message || defaultErrorMessage, {
        status: res.status,
        code,
        attempts: attempt,
      });

      const retryable =
        RETRYABLE_STATUSES.has(res.status) && !NON_RETRYABLE_CODES.has(code);
      if (!retryable || attempt >= maxAttempts) {
        throw lastError;
      }

      const retryAfter = res.headers.get("retry-after");
      const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : NaN;
      const delayMs = Number.isFinite(retryAfterMs)
        ? Math.min(maxDelayMs, retryAfterMs)
        : Math.min(maxDelayMs, minDelayMs * 2 ** (attempt - 1));
      await sleep(delayMs);
      continue;
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      const isAbort =
        error instanceof Error && error.name === "AbortError";
      lastError = buildError(
        isAbort
          ? resolvedTimeoutMessage
          : error instanceof Error
            ? error.message
            : defaultErrorMessage,
        {
          attempts: attempt,
        },
      );
      if (attempt >= maxAttempts) {
        throw lastError;
      }
      const delayMs = Math.min(maxDelayMs, minDelayMs * 2 ** (attempt - 1));
      await sleep(delayMs);
    }
  }

  throw lastError;
}
