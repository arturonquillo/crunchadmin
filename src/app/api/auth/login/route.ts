import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  adminCookieOptions,
  adminMisconfiguredInProduction,
  adminPassword,
  sessionToken,
} from "@/lib/admin-session";
import { clientIp, pruneRateLimits, rateLimit } from "@/lib/rate-limit";

function sameSecret(input: string, expected: string): boolean {
  const left = Buffer.from(input);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function POST(req: NextRequest) {
  if (adminMisconfiguredInProduction()) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD es obligatorio en producción" },
      { status: 503 }
    );
  }

  const password = adminPassword();
  if (!password) {
    return NextResponse.json({ ok: true, auth: "open" });
  }

  pruneRateLimits();
  const ip = clientIp(req);
  const limited = rateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera e inténtalo de nuevo." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      }
    );
  }

  const body = await req.json().catch(() => null);
  const given = String(body?.password ?? "");
  if (!sameSecret(given, password)) {
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, await sessionToken(password), adminCookieOptions());
  return res;
}
