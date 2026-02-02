import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { connectMongo } from "@/lib/mongo";
import { UploadFileRecordModel } from "@/models/UploadFileRecord";

export const runtime = "nodejs";

const MAX_FILE_SIZE_MB = Number(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB ?? 50);
const MAX_FILE_SIZE_BYTES = Number.isFinite(MAX_FILE_SIZE_MB)
  ? MAX_FILE_SIZE_MB * 1024 * 1024
  : 50 * 1024 * 1024;
const MAX_FILE_SIZE_LABEL = Number.isFinite(MAX_FILE_SIZE_MB)
  ? `${MAX_FILE_SIZE_MB}MB`
  : "50MB";
const FILE_SIZE_ERROR_MESSAGE = `حجم الملف أكبر من الحد المسموح (${MAX_FILE_SIZE_LABEL}).`;

const ARCHIVE_ROOT =
  process.env.UPLOAD_ARCHIVE_DIR || path.join(process.cwd(), "uploads");
const TEMP_ROOT = process.env.UPLOAD_TEMP_DIR || ARCHIVE_ROOT;

const normalizeRoot = (root: string) => {
  const resolved = path.resolve(root);
  return resolved.endsWith(path.sep) ? resolved : `${resolved}${path.sep}`;
};

const isPathInsideRoot = (root: string, target: string) =>
  path.resolve(target).startsWith(normalizeRoot(root));

const ensureSafePath = (baseDir: string, targetPath: string) => {
  const resolvedBase = normalizeRoot(baseDir);
  const resolvedTarget = path.resolve(targetPath);
  if (!resolvedTarget.startsWith(resolvedBase)) {
    throw new Error("Invalid storage path.");
  }
  return resolvedTarget;
};

const sanitizeSegment = (value: string) =>
  value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80);

const isPdfFile = (file: File) => {
  const name = file.name?.toLowerCase() ?? "";
  return file.type === "application/pdf" || name.endsWith(".pdf");
};

const moveFile = async (from: string, to: string) => {
  try {
    await fs.rename(from, to);
  } catch {
    await fs.copyFile(from, to);
    await fs.unlink(from);
  }
};

export async function POST(request: Request) {
  let localFileId = "";
  try {
    const formData = await request.formData();
    const clientIdValue = formData.get("clientId") ?? formData.get("clientCode");
    const localFileIdValue = formData.get("localFileId");
    const fileValue = formData.get("file");

    if (typeof clientIdValue !== "string" || !clientIdValue.trim()) {
      return NextResponse.json(
        { message: "حقل clientId مطلوب.", code: "INVALID_CLIENT_ID" },
        { status: 400 }
      );
    }
    if (typeof localFileIdValue !== "string" || !localFileIdValue.trim()) {
      return NextResponse.json(
        { message: "حقل localFileId مطلوب.", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }
    if (!(fileValue instanceof File)) {
      return NextResponse.json(
        { message: "يجب إرسال ملف.", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const clientId = clientIdValue.trim();
    localFileId = localFileIdValue.trim();
    const file = fileValue;

    if (!isPdfFile(file)) {
      return NextResponse.json(
        { message: "يسمح بملفات PDF فقط.", code: "INVALID_FILE_TYPE" },
        { status: 415 }
      );
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { message: FILE_SIZE_ERROR_MESSAGE, code: "UPLOAD_LIMIT" },
        { status: 413 }
      );
    }

    await connectMongo();

    const existing = await UploadFileRecordModel.findOne({ localFileId }).lean();
    if (existing?.status === "done") {
      return NextResponse.json(
        {
          ok: true,
          duplicated: true,
          localFileId,
          storagePath: existing.storagePath,
          filePath: existing.storagePath,
        },
        { status: 200 }
      );
    }

    const now = new Date();
    await UploadFileRecordModel.findOneAndUpdate(
      { localFileId },
      {
        $set: {
          localFileId,
          clientId,
          originalName: file.name,
          size: file.size,
          mime: file.type,
          status: "uploading",
          lastError: "",
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
        $inc: { attempts: 1 },
      },
      { upsert: true, new: true }
    );

    const safeClientId = sanitizeSegment(clientId) || "client";
    const safeLocalId = sanitizeSegment(localFileId);
    if (!safeLocalId) {
      throw new Error("Invalid localFileId.");
    }

    const tempDir = path.join(TEMP_ROOT, safeClientId);
    const clientDir = path.join(ARCHIVE_ROOT, safeClientId);
    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(clientDir, { recursive: true });

    const tempPath = ensureSafePath(
      TEMP_ROOT,
      path.join(tempDir, `${safeLocalId}.pdf`)
    );
    const finalPath = ensureSafePath(
      ARCHIVE_ROOT,
      path.join(clientDir, `${safeLocalId}.pdf`)
    );

    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(tempPath, Buffer.from(arrayBuffer));
    await moveFile(tempPath, finalPath);

    const storagePath = finalPath.replace(/\\/g, "/");

    await UploadFileRecordModel.updateOne(
      { localFileId },
      {
        $set: {
          status: "done",
          storagePath,
          lastError: "",
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json(
      {
        ok: true,
        localFileId,
        storagePath,
        filePath: storagePath,
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "حدث خطأ أثناء رفع الملف.";
    if (localFileId) {
      try {
        await connectMongo();
        await UploadFileRecordModel.updateOne(
          { localFileId },
          {
            $set: {
              status: "failed",
              lastError: message,
              updatedAt: new Date(),
            },
          }
        );
      } catch (dbError) {
        console.error("Failed to update upload record:", dbError);
      }
    }
    console.error("Archive upload failed:", error);
    return NextResponse.json({ message }, { status: 500 });
  }
}
