import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_COOKIE,
  adminAuthEnabled,
  expectedSessionToken,
} from "@/lib/admin-session";

const PUBLIC_PREFIXES = ["/qr/", "/api/public/", "/api/auth/"];

export async function middleware(req: NextRequest) {
  if (!adminAuthEnabled()) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname === "/login" || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  const expected = await expectedSessionToken();
  if (token && expected && token === expected) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const login = req.nextUrl.clone();
  login.pathname = "/login";
  login.search = `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads/).*)"],
};
