import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  adminMisconfiguredInProduction,
  readAdminSession,
  sameOriginMutation,
} from "@/lib/admin-session";

/**
 * Defense-in-depth for mutating (and sensitive) API handlers.
 * Returns a response to send when the caller must be blocked; otherwise null.
 */
export async function requireAdmin(
  req: NextRequest,
  options: { mutate?: boolean } = { mutate: true }
): Promise<NextResponse | null> {
  if (adminMisconfiguredInProduction()) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD es obligatorio en producción" },
      { status: 503 }
    );
  }

  const session = await readAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
  if (!session.enabled) {
    // Local/dev without password — allow (middleware also open).
    return null;
  }
  if (!session.authenticated) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (options.mutate !== false && !sameOriginMutation(req)) {
    return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  }

  return null;
}
