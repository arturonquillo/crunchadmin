import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  adminPassword,
  sessionToken,
} from "@/lib/admin-session";

function sameSecret(input: string, expected: string): boolean {
  const left = Buffer.from(input);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function POST(req: NextRequest) {
  const password = adminPassword();
  if (!password) {
    return NextResponse.json({ ok: true, auth: "open" });
  }

  const body = await req.json().catch(() => null);
  const given = String(body?.password ?? "");
  if (!sameSecret(given, password)) {
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, await sessionToken(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
