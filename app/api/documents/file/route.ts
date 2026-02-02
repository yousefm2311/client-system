import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import path from "path";
import fs from "fs/promises";
import { getAuthUserFromCookies } from "@/lib/auth";
import { connectMongo } from "@/lib/mongo";
import { ClientDocumentModel } from "@/models/ClientDocument";
import { getUserBranch, normalizeBranch } from "@/lib/permissions";
import { canAccessAllBranches } from "@/lib/permissions-special";
import { buildDocumentFileName, correctDocName } from "@/lib/documents";
import { Buffer } from "node:buffer";
import { recordAuditLog } from "@/lib/audit-log";

export const runtime = "nodejs";

const archiveBase =
  process.env.ARCHIVE_SERVICE_URL ||
  process.env.NEXT_PUBLIC_ARCHIVE_SERVICE_URL ||
  "http://localhost:5000";
const archiveRoot =
  process.env.UPLOAD_ARCHIVE_DIR || path.join(process.cwd(), "uploads");
const legacyUploadsRoot = path.join(process.cwd(), "uploads");

const normalizeArchiveUrl = (rawUrl: string) => {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const apiMatch = trimmed.match(/\/?api\/archives\/([0-9a-f]{24})/i);
  if (apiMatch) {
    return `${archiveBase}/api/archives/${apiMatch[1]}/download`;
  }

  const archiveMatch = trimmed.match(/archives\/([0-9a-f]{24})/i);
  if (archiveMatch) {
    return `${archiveBase}/api/archives/${archiveMatch[1]}/download`;
  }

  const idMatch = trimmed.match(/([0-9a-f]{24})/i);
  if (idMatch) {
    return `${archiveBase}/api/archives/${idMatch[1]}/download`;
  }

  if (/^\/?api\/archives\//i.test(trimmed)) {
    const prefix = trimmed.startsWith("/") ? "" : "/";
    return `${archiveBase}${prefix}${trimmed}`;
  }

  return trimmed;
};

const normalizeRoot = (root: string) => {
  const resolved = path.resolve(root);
  return resolved.endsWith(path.sep) ? resolved : `${resolved}${path.sep}`;
};

const isPathInsideRoot = (root: string, target: string) =>
  path.resolve(target).startsWith(normalizeRoot(root));

const isLocalUploadPath = (value: string) => {
  if (!value) return false;
  if (/^https?:\/\//i.test(value)) return false;
  if (path.isAbsolute(value)) {
    return (
      isPathInsideRoot(archiveRoot, value) ||
      isPathInsideRoot(legacyUploadsRoot, value)
    );
  }
  const normalized = value.replace(/\\/g, "/");
  return normalized.startsWith("uploads/") || normalized.startsWith("archives/");
};

const resolveLocalUploadPath = (value: string) => {
  if (path.isAbsolute(value)) {
    if (
      !isPathInsideRoot(archiveRoot, value) &&
      !isPathInsideRoot(legacyUploadsRoot, value)
    ) {
      throw new Error("Invalid local file path.");
    }
    return path.resolve(value);
  }

  const normalized = value.replace(/\\/g, "/");
  const targetPath = normalized.startsWith("uploads/")
    ? path.join(process.cwd(), normalized)
    : path.join(archiveRoot, normalized);
  const root = normalized.startsWith("uploads/")
    ? legacyUploadsRoot
    : archiveRoot;
  if (!isPathInsideRoot(root, targetPath)) {
    throw new Error("Invalid local file path.");
  }
  return path.resolve(targetPath);
};

const guessContentType = (ext: string) => {
  const e = ext.toLowerCase();
  if ([".pdf"].includes(e)) return "application/pdf";
  if ([".jpg", ".jpeg"].includes(e)) return "image/jpeg";
  if ([".png"].includes(e)) return "image/png";
  return "application/octet-stream";
};

const pickExt = (name: string) => {
  if (!name) return "";
  const clean = name.split("?")[0];
  const part = clean.split("/").pop() || "";
  if (part.includes(".")) {
    const ext = "." + (part.split(".").pop() || "");
    return ext;
  }
  return "";
};

export async function GET(request: NextRequest) {
  const user = await getAuthUserFromCookies();
  if (!user) {
    await recordAuditLog({
      action: "document.view",
      status: "failure",
      message: "غير مصرح، يرجى تسجيل الدخول.",
      reason: "unauthorized",
      request,
    });
    return NextResponse.json({ message: "غير مصرح، يرجى تسجيل الدخول." }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const docId = searchParams.get("docId");
  const forceDownload =
    searchParams.get("download") === "1" ||
    searchParams.get("download")?.toLowerCase() === "true";
  if (!docId) {
    await recordAuditLog({
      action: "document.view",
      status: "failure",
      message: "معرّف المستند docId مفقود.",
      reason: "missing_doc_id",
      user,
      request,
    });
    return NextResponse.json({ message: "معرّف المستند docId مفقود." }, { status: 400 });
  }

  await connectMongo();
  const doc = await ClientDocumentModel.findById(docId).lean();
  if (!doc) {
    await recordAuditLog({
      action: "document.view",
      status: "failure",
      message: "لم يتم العثور على المستند.",
      reason: "not_found",
      user,
      request,
      docId,
    });
    return NextResponse.json({ message: "لم يتم العثور على المستند." }, { status: 404 });
  }

  const userBranch = normalizeBranch(getUserBranch(user));
  const canAll = canAccessAllBranches(user);
  const docBranch = normalizeBranch((doc as any).branch);

  if (!canAll && docBranch && docBranch !== userBranch) {
    await recordAuditLog({
      action: "document.view",
      status: "failure",
      message: "غير مصرح لك بعرض مستند من فرع آخر.",
      reason: "forbidden",
      user,
      request,
      docId,
      clientCode: (doc as any).clientCode,
    });
    return NextResponse.json(
      { message: "غير مصرح لك بعرض مستند من فرع آخر." },
      { status: 403 }
    );
  }

  const storedUrl = (doc as any).fileUrl || (doc as any).filePath;
  if (!storedUrl || typeof storedUrl !== "string") {
    await recordAuditLog({
      action: "document.view",
      status: "failure",
      message: "رابط الملف غير متوفر.",
      reason: "missing_file_url",
      user,
      request,
      docId,
      clientCode: (doc as any).clientCode,
    });
    return NextResponse.json({ message: "رابط الملف غير متوفر." }, { status: 404 });
  }

  try {
    if (isLocalUploadPath(storedUrl)) {
      const resolvedPath = resolveLocalUploadPath(storedUrl);
      const fileBuffer = await fs.readFile(resolvedPath);
      const ext = path.extname(resolvedPath) || ".pdf";
      const safeName = buildDocumentFileName(
        correctDocName((doc as any).docName || "document"),
        (doc as any).clientCode || "",
        `file${ext}`
      );
      const asciiName = safeName.replace(/[^\x20-\x7E]/g, "_") || `file${ext}`;
      const disposition = forceDownload ? "attachment" : "inline";
      const contentDisposition = `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(
        safeName
      )}`;

      await recordAuditLog({
        action: "document.view",
        status: "success",
        message: "Local file served.",
        user,
        request,
        docId,
        clientCode: (doc as any).clientCode,
        details: { forceDownload, local: true },
      });

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": guessContentType(ext),
          "Content-Disposition": contentDisposition,
          "Content-Length": fileBuffer.byteLength.toString(),
        },
      });
    }

    const fileUrl = normalizeArchiveUrl(storedUrl);
    if (!fileUrl || !/^https?:\/\//i.test(fileUrl)) {
      await recordAuditLog({
        action: "document.view",
        status: "failure",
        message: "Invalid file URL.",
        reason: "invalid_file_url",
        user,
        request,
        docId,
        clientCode: (doc as any).clientCode,
      });
      return NextResponse.json({ message: "Invalid file URL." }, { status: 404 });
    }

    const cookieHeader = request.headers.get("cookie") || undefined;
    const res = await fetch(fileUrl, {
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        Accept: "application/octet-stream,application/pdf,*/*",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      await recordAuditLog({
        action: "document.view",
        status: "failure",
        message: "تعذر تحميل الملف من خدمة الأرشفة.",
        reason: `status_${res.status}`,
        user,
        request,
        docId,
        clientCode: (doc as any).clientCode,
      });
      return NextResponse.json(
        { message: "تعذر تحميل الملف من خدمة الأرشفة." },
        { status: 502 }
      );
    }

    const arrayBuffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "";
    const looksLikeZip =
      contentType.includes("application/zip") ||
      contentType.includes("application/x-zip") ||
      /\.zip(\?|$)/i.test(storedUrl);

    let bufferToSend: Uint8Array = new Uint8Array(arrayBuffer);
    let ext = pickExt(storedUrl) || ".pdf";

    if (looksLikeZip) {
      try {
        const zip = await JSZip.loadAsync(arrayBuffer);
        const files = Object.values(zip.files).filter((f) => !f.dir);

        const selected = files.find((f) => f.name.toLowerCase().endsWith(".pdf")) || files[0];
        if (!selected) {
          await recordAuditLog({
            action: "document.view",
            status: "failure",
            message: "ملف ZIP لا يحتوي على ملفات صالحة.",
            reason: "zip_empty",
            user,
            request,
            docId,
            clientCode: (doc as any).clientCode,
          });
          return NextResponse.json(
            { message: "ملف ZIP لا يحتوي على ملفات صالحة." },
            { status: 500 }
          );
        }
        bufferToSend = await selected.async("uint8array");
        ext = pickExt(selected.name) || ".pdf";
      } catch {
        await recordAuditLog({
          action: "document.view",
          status: "failure",
          message: "تعذر فك ضغط الملف المضغوط.",
          reason: "zip_extract_failed",
          user,
          request,
          docId,
          clientCode: (doc as any).clientCode,
        });
        return NextResponse.json(
          { message: "تعذر فك ضغط الملف المضغوط." },
          { status: 500 }
        );
      }
    }

    const safeName = buildDocumentFileName(
      correctDocName((doc as any).docName || "document"),
      (doc as any).clientCode || "",
      `file${ext}`
    );

    const asciiName = safeName.replace(/[^\x20-\x7E]/g, "_") || `file${ext}`;
    const disposition = forceDownload ? "attachment" : "inline";
    const contentDisposition = `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(
      safeName
    )}`;

    // استخدم Buffer وضف Content-Length للمتصفح
    const nodeBuffer = Buffer.from(bufferToSend);

    await recordAuditLog({
      action: "document.view",
      status: "success",
      message: "تم عرض الملف بنجاح.",
      user,
      request,
      docId,
      clientCode: (doc as any).clientCode,
      details: { forceDownload },
    });

    return new NextResponse(nodeBuffer, {
      status: 200,
      headers: {
        "Content-Type": guessContentType(ext),
        "Content-Disposition": contentDisposition,
        "Content-Length": nodeBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("Stream document failed:", error);
    await recordAuditLog({
      action: "document.view",
      status: "failure",
      message: "تعذر عرض الملف، حاول لاحقاً.",
      reason: error instanceof Error ? error.message : "stream_failed",
      user,
      request,
      docId,
      clientCode: (doc as any).clientCode,
    });
    return NextResponse.json(
      { message: "تعذر عرض الملف، حاول لاحقاً." },
      { status: 500 }
    );
  }
}
