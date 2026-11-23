import { NextResponse } from "next/server";
import { destroySession, readCookie, sessionCookieName } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/security/request";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false }, { status: 403 });
  await destroySession(readCookie(request.headers.get("cookie"), sessionCookieName()));
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookieName(), "", { httpOnly: true, path: "/", expires: new Date(0), secure: sessionCookieName().startsWith("__Host-"), sameSite: "lax" });
  return res;
}
