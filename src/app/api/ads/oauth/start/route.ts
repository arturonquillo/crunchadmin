import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { isMetaConfigured } from "@/lib/meta/config";
import { oauthDialogUrl } from "@/lib/meta/client";
import { signOAuthState } from "@/lib/meta/oauth-state";

export async function GET() {
  if (!isMetaConfigured()) {
    return NextResponse.json(
      {
        error:
          "Meta no configurado. Definí META_APP_ID y META_APP_SECRET, o usá /api/ads/mock/connect.",
      },
      { status: 400 }
    );
  }
  const nonce = randomBytes(16).toString("hex");
  const state = signOAuthState(nonce);
  const url = oauthDialogUrl(state);
  const res = NextResponse.redirect(url);
  res.cookies.set("crunchadmin_meta_oauth", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
