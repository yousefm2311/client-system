import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { getAuthUserFromCookies } from "@/lib/auth";
import { connectMongo } from "@/lib/mongo";
import { ClientDocumentModel } from "@/models/ClientDocument";
import { getUserBranch, normalizeBranch } from "@/lib/permissions";
import { canAccessAllBranches } from "@/lib/permissions-special";
import { buildDocumentFileName, correctDocName } from "@/lib/documents";
import { Buffer } from "node:buffer";

export const runtime = "nodejs";

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
    return NextResponse.json({ message: "غير مصرح، يرجى تسجيل الدخول." }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const docId = searchParams.get("docId");
  const forceDownload =
    searchParams.get("download") === "1" ||
    searchParams.get("download")?.toLowerCase() === "true";
  if (!docId) {
    return NextResponse.json({ message: "معرّف المستند docId مفقود." }, { status: 400 });
  }

  await connectMongo();
  const doc = await ClientDocumentModel.findById(docId).lean();
  if (!doc) {
    return NextResponse.json({ message: "لم يتم العثور على المستند." }, { status: 404 });
  }

  const userBranch = normalizeBranch(getUserBranch(user));
  const canAll = canAccessAllBranches(user);
  const docBranch = normalizeBranch((doc as any).branch);

  if (!canAll && docBranch && docBranch !== userBranch) {
    return NextResponse.json(
      { message: "غير مصرح لك بعرض مستند من فرع آخر." },
      { status: 403 }
    );
  }

  const fileUrl = (doc as any).fileUrl || (doc as any).filePath;
  if (!fileUrl || typeof fileUrl !== "string") {
    return NextResponse.json({ message: "رابط الملف غير متوفر." }, { status: 404 });
  }

  try {
    const cookieHeader = request.headers.get("cookie") || undefined;
    const res = await fetch(fileUrl, {
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        Accept: "application/octet-stream,application/pdf,*/*",
      },
      cache: "no-store",
    });

    if (!res.ok) {
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
      /\.zip(\?|$)/i.test(fileUrl);

    let bufferToSend: Uint8Array = new Uint8Array(arrayBuffer);
    let ext = pickExt(fileUrl) || ".pdf";

    if (looksLikeZip) {
      try {
        const zip = await JSZip.loadAsync(arrayBuffer);
        const files = Object.values(zip.files).filter((f) => !f.dir);

        const selected = files.find((f) => f.name.toLowerCase().endsWith(".pdf")) || files[0];
        if (!selected) {
          return NextResponse.json(
            { message: "ملف ZIP لا يحتوي على ملفات صالحة." },
            { status: 500 }
          );
        }
        bufferToSend = await selected.async("uint8array");
        ext = pickExt(selected.name) || ".pdf";
      } catch {
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
    return NextResponse.json(
      { message: "تعذر عرض الملف، حاول لاحقاً." },
      { status: 500 }
    );
  }
}
