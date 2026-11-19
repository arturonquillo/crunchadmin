import { NextResponse } from "next/server";
import { runWithPrisma } from "@/lib/prisma";
import { getConnectionStatus } from "@/lib/meta/service";
import { isMetaConfigured, getMetaRedirectUri, getGraphApiVersion } from "@/lib/meta/config";

export async function GET() {
  return runWithPrisma(async () => {
    const status = await getConnectionStatus();
    return NextResponse.json({
      ...status,
      graphVersion: getGraphApiVersion(),
      redirectUri: getMetaRedirectUri(),
      realOAuthAvailable: isMetaConfigured(),
    });
  });
}
