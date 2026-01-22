import { NextResponse } from "next/server";
import { getAuthUserFromCookies } from "@/lib/auth";
import { getSqlPool, sql } from "@/lib/sql";

type Body = {
  oldPassword?: string;
  newPassword?: string;
};

export async function POST(request: Request) {
  const user = await getAuthUserFromCookies();
  if (!user) {
    return NextResponse.json({ message: "الرجاء تسجيل الدخول" }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  if (!body.oldPassword || !body.newPassword) {
    return NextResponse.json(
      { message: "يرجى إدخال كلمة المرور الحالية والجديدة" },
      { status: 400 }
    );
  }

  try {
    const pool = await getSqlPool();
    await pool
      .request()
      .input("EmpId", sql.VarChar, user.empId)
      .input("OldPassword", sql.VarChar, body.oldPassword)
      .input("NewPassword", sql.VarChar, body.newPassword)
      .execute("UpdateUserPass");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("UpdateUserPass failed:", error);
    return NextResponse.json(
      { message: "حدث خطأ أثناء تحديث كلمة المرور" },
      { status: 500 }
    );
  }
}
