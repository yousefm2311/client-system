import { NextResponse } from "next/server";

export const runtime = "nodejs";

const archiveBase =
  process.env.ARCHIVE_SERVICE_URL ||
  process.env.NEXT_PUBLIC_ARCHIVE_SERVICE_URL ||
  "http://localhost:5000";

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientCode = searchParams.get("clientCode");
    if (!clientCode) {
      return NextResponse.json({ message: "حقل clientCode مطلوب" }, { status: 400 });
    }

    const incomingForm = await request.formData();
    const file = incomingForm.get("file") || incomingForm.get("files");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ message: "يجب إرسال ملف واحد على الأقل" }, { status: 400 });
    }

    const proxyForm = new FormData();
    proxyForm.append("files", file);

    const archiveRes = await fetch(`${archiveBase}/api/archives/${clientCode}/upload`, {
      method: "POST",
      body: proxyForm,
    });

    const data =
      (await archiveRes.json().catch(async () => {
        try {
          const text = await archiveRes.text();
          return { raw: text };
        } catch {
          return {};
        }
      })) || {};

    if (!archiveRes.ok) {
      return NextResponse.json(
        { message: data.message || "تعذر رفع الملف إلى خدمة الأرشفة" },
        { status: archiveRes.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Archive upload proxy failed:", error);
    return NextResponse.json(
      { message: "حدث خطأ أثناء رفع الملف للأرشفة" },
      { status: 500 }
    );
  }
}
