import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  DB_MODE_COOKIE,
  DEFAULT_DB_MODE,
  dbPathHint,
  isDbMode,
  type DbMode,
} from "@/lib/db-mode";
import { getDbMode } from "@/lib/prisma";

export async function GET() {
  const mode = await getDbMode();
  return NextResponse.json({
    mode,
    activeFile: dbPathHint(mode),
    desarrolloFile: dbPathHint("desarrollo"),
    produccionFile: dbPathHint("produccion"),
  });
}

export async function POST(req: NextRequest) {
  let next: DbMode = DEFAULT_DB_MODE;
  try {
    const body = await req.json();
    if (isDbMode(body?.mode)) next = body.mode;
  } catch {
    /* empty body → default */
  }

  const store = await cookies();
  store.set(DB_MODE_COOKIE, next, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  return NextResponse.json({
    mode: next,
    activeFile: dbPathHint(next),
  });
}
