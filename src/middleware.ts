import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_COOKIE,
  adminAuthEnabled,
  adminMisconfiguredInProduction,
  expectedSessionToken,
  safeEqual,
  sameOriginMutation,
} from "@/lib/admin-session";

const PUBLIC_PREFIXES = ["/qr/", "/api/public/"];
const AUTH_API_PREFIX = "/api/auth/";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic =
    pathname === "/login" ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isAuthApi = pathname.startsWith(AUTH_API_PREFIX);

  // Production without ADMIN_PASSWORD: keep public QR/site reads; block panel + writes.
  if (adminMisconfiguredInProduction()) {
    if (isPublic || pathname === "/api/auth/status") {
      return NextResponse.next();
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "ADMIN_PASSWORD es obligatorio en producción" },
        { status: 503 }
      );
    }
    return new NextResponse(
      "Panel no disponible: falta ADMIN_PASSWORD en el servidor.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  if (!adminAuthEnabled()) return NextResponse.next();

  if (isPublic || isAuthApi) {
    return NextResponse.next();
  }

  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  const expected = await expectedSessionToken();
  const authenticated = Boolean(token && expected && safeEqual(token, expected));

  if (!authenticated) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const login = req.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(login);
  }

  // Optional CSRF for cookie-authenticated mutations (API + form posts).
  const method = req.method.toUpperCase();
  if (
    pathname.startsWith("/api/") &&
    method !== "GET" &&
    method !== "HEAD" &&
    method !== "OPTIONS" &&
    !sameOriginMutation(req)
  ) {
    return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads/).*)"],
};
