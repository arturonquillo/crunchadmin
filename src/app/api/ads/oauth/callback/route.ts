import { NextRequest, NextResponse } from "next/server";
import { runWithPrisma } from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/meta/config";
import { connectWithOAuthCode } from "@/lib/meta/service";
import { verifyOAuthState } from "@/lib/meta/oauth-state";

export async function GET(req: NextRequest) {
  const base = getAppBaseUrl();
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const err = req.nextUrl.searchParams.get("error");
  const cookieState = req.cookies.get("crunchadmin_meta_oauth")?.value;

  if (err) {
    return NextResponse.redirect(
      `${base}/ads?error=${encodeURIComponent(err)}`
    );
  }
  if (!code || !state || state !== cookieState || !verifyOAuthState(state)) {
    return NextResponse.redirect(
      `${base}/ads?error=${encodeURIComponent("oauth_state_invalid")}`
    );
  }

  try {
    await runWithPrisma(() => connectWithOAuthCode(code));
    const res = NextResponse.redirect(`${base}/ads?connected=1`);
    res.cookies.set("crunchadmin_meta_oauth", "", { path: "/", maxAge: 0 });
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "oauth_failed";
    return NextResponse.redirect(
      `${base}/ads?error=${encodeURIComponent(msg)}`
    );
  }
}
