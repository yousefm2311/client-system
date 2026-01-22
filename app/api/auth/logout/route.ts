import { NextResponse } from "next/server";
import { JWT_COOKIE_NAME, authCookieOptions } from "@/lib/auth";

const buildRedirect = (request: Request) => {
  const headers = new Headers(request.headers);
  const host = headers.get("x-forwarded-host") || headers.get("host") || "localhost:9090";
  const proto = headers.get("x-forwarded-proto") || "http";
  const loginUrl = new URL(`${proto}://${host}/login`);
  const response = NextResponse.redirect(loginUrl);
  response.cookies.set(JWT_COOKIE_NAME, "", { ...authCookieOptions, maxAge: 0 });
  return response;
};

export async function POST(request: Request) {
  return buildRedirect(request);
}

export async function GET(request: Request) {
  return buildRedirect(request);
}
