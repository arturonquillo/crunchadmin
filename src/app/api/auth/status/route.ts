import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  adminAuthEnabled,
  expectedSessionToken,
} from "@/lib/admin-session";

export async function GET(req: NextRequest) {
  const enabled = adminAuthEnabled();
  const expected = await expectedSessionToken();
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  return NextResponse.json({
    enabled,
    authenticated: !enabled || (Boolean(expected) && token === expected),
  });
}
