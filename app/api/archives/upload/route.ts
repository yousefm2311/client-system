import { NextResponse } from "next/server";

export const runtime = "nodejs";

const archiveBase =
  process.env.ARCHIVE_SERVICE_URL ||
  process.env.NEXT_PUBLIC_ARCHIVE_SERVICE_URL ||
  "http://localhost:5000";

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const PROXY_MAX_RETRIES = Number(process.env.ARCHIVE_PROXY_MAX_RETRIES || 1);
const PROXY_RETRY_DELAY_MS = Number(
  process.env.ARCHIVE_PROXY_RETRY_DELAY_MS || 700
);
const PROXY_RETRY_MAX_DELAY_MS = Number(
  process.env.ARCHIVE_PROXY_RETRY_MAX_DELAY_MS || 3000
);
const PROXY_TIMEOUT_MS = Number(
  process.env.ARCHIVE_PROXY_TIMEOUT_MS || 30000
);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientCode = searchParams.get("clientCode");
    if (!clientCode) {
      return NextResponse.json({ message: "Ø­Ù‚Ù„ clientCode Ù…Ø·Ù„ÙˆØ¨" }, { status: 400 });
    }

    const incomingForm = await request.formData();
    const file = incomingForm.get("file") || incomingForm.get("files");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ message: "ÙŠØ¬Ø¨ Ø¥Ø±Ø³Ø§Ù„ Ù…Ù„Ù ÙˆØ§Ø­Ø¯ Ø¹Ù„Ù‰ Ø§Ù„Ø£Ù‚Ù„" }, { status: 400 });
    }

    const forwardedFor =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "";

    const buildProxyForm = () => {
      const proxyForm = new FormData();
      proxyForm.append("files", file);
      return proxyForm;
    };

    const maxAttempts = Math.max(1, PROXY_MAX_RETRIES + 1);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      let archiveRes: Response;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        const controller =
          PROXY_TIMEOUT_MS > 0 ? new AbortController() : undefined;
        timeoutId = controller
          ? setTimeout(() => controller?.abort(), PROXY_TIMEOUT_MS)
          : undefined;

        archiveRes = await fetch(
          `${archiveBase}/api/archives/${clientCode}/upload`,
          {
            method: "POST",
            body: buildProxyForm(),
            headers: {
              ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
              "x-client-code": clientCode,
            },
            signal: controller?.signal,
          }
        );
      } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        if (attempt >= maxAttempts) {
          throw error;
        }
        const delayMs = Math.min(
          PROXY_RETRY_MAX_DELAY_MS,
          PROXY_RETRY_DELAY_MS * 2 ** (attempt - 1)
        );
        await sleep(delayMs);
        continue;
      }
      if (timeoutId) clearTimeout(timeoutId);

      const data =
        (await archiveRes.json().catch(async () => {
          try {
            const text = await archiveRes.text();
            return { raw: text };
          } catch {
            return {};
          }
        })) || {};

      if (archiveRes.ok) {
        return NextResponse.json(data);
      }

      const { message, code } = parseErrorPayload(data);
      const canRetry =
        RETRYABLE_STATUSES.has(archiveRes.status) && attempt < maxAttempts;

      if (!canRetry) {
        return NextResponse.json(
          {
            message:
              message ||
              "ØªØ¹Ø°Ø± Ø±ÙØ¹ Ø§Ù„Ù…Ù„Ù Ø¥Ù„Ù‰ Ø®Ø¯Ù…Ø© Ø§Ù„Ø£Ø±Ø´ÙØ©",
            code,
          },
          { status: archiveRes.status }
        );
      }

      const retryAfter = archiveRes.headers.get("retry-after");
      const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : NaN;
      const delayMs = Number.isFinite(retryAfterMs)
        ? Math.min(PROXY_RETRY_MAX_DELAY_MS, retryAfterMs)
        : Math.min(
            PROXY_RETRY_MAX_DELAY_MS,
            PROXY_RETRY_DELAY_MS * 2 ** (attempt - 1)
          );
      await sleep(delayMs);
    }

    return NextResponse.json(
      { message: "ØªØ¹Ø°Ø± Ø±ÙØ¹ Ø§Ù„Ù…Ù„Ù Ø¥Ù„Ù‰ Ø®Ø¯Ù…Ø© Ø§Ù„Ø£Ø±Ø´ÙØ©" },
      { status: 502 }
    );
  } catch (error) {
    console.error("Archive upload proxy failed:", error);
    return NextResponse.json(
      { message: "Ø­Ø¯Ø« Ø®Ø·Ø£ Ø£Ø«Ù†Ø§Ø¡ Ø±ÙØ¹ Ø§Ù„Ù…Ù„Ù Ù„Ù„Ø£Ø±Ø´ÙØ©" },
      { status: 500 }
    );
  }
}
