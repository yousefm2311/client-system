import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getAuthUserFromCookies } from "@/lib/auth";
import { connectMongo } from "@/lib/mongo";
import { ClientDocumentModel } from "@/models/ClientDocument";
import { ArchiveModel } from "@/models/Archive";
import { getUserBranch } from "@/lib/permissions";
import { canAccessAllBranches } from "@/lib/permissions-special";

type DeleteBody = {
  docId?: number | string;
};

const archiveBase =
  process.env.ARCHIVE_SERVICE_URL ||
  process.env.NEXT_PUBLIC_ARCHIVE_SERVICE_URL ||
  "http://localhost:5000";

const extractArchiveId = (url: string) => {
  try {
    const match = url.match(/archives\/([^/]+)/i);
    return match?.[1];
  } catch {
    return undefined;
  }
};

export async function POST(request: Request) {
  const user = await getAuthUserFromCookies();
  if (!user) {
    return NextResponse.json({ message: "غير مصرح" }, { status: 401 });
  }

  const branch = getUserBranch(user);
  const canDeleteAll = canAccessAllBranches(user);

  const body = (await request.json()) as DeleteBody;
  const docId = body.docId;
  if (!docId) {
    return NextResponse.json({ message: "docId مطلوب" }, { status: 400 });
  }

  try {
    await connectMongo();

    const existing = await ClientDocumentModel.findById(docId).lean();
    if (!existing) {
      return NextResponse.json({ message: "المستند غير موجود" }, { status: 404 });
    }

    const filter: Record<string, unknown> = {
      _id: new mongoose.Types.ObjectId(String(docId)),
    };
    if (!canDeleteAll) {
      filter.branch = branch;
    }

    const res = await ClientDocumentModel.deleteOne(filter);
    if (res.deletedCount === 0) {
      return NextResponse.json(
        { message: "المستند غير موجود أو ليس لديك صلاحية الحذف" },
        { status: 404 }
      );
    }

    const fileUrl = (existing as any).fileUrl || (existing as any).filePath;
    const archiveId = typeof fileUrl === "string" ? extractArchiveId(fileUrl) : undefined;
    let archiveDeleted = false;

    if (archiveId) {
      try {
        await fetch(`${archiveBase}/api/archives/${archiveId}`, { method: "DELETE" });
        archiveDeleted = true;
      } catch (err) {
        console.error("Failed to delete archive remotely:", err);
      }

      try {
        await ArchiveModel.deleteOne({ archivePath: new RegExp(archiveId) });
      } catch (err) {
        console.error("Failed to delete archive record:", err);
      }
    }

    return NextResponse.json({ success: true, archiveDeleted });
  } catch (error) {
    console.error("DeleteClientDoc failed:", error);
    return NextResponse.json({ message: "تعذر حذف المستند" }, { status: 500 });
  }
}
