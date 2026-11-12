import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  adminMisconfiguredInProduction,
  readAdminSession,
} from "@/lib/admin-session";

export async function GET(req: NextRequest) {
  if (adminMisconfiguredInProduction()) {
    return NextResponse.json({
      enabled: false,
      authenticated: false,
      misconfigured: true,
    });
  }

  const session = await readAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
  return NextResponse.json({
    enabled: session.enabled,
    authenticated: session.authenticated,
    misconfigured: false,
  });
}
