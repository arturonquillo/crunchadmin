import { NextResponse } from "next/server";
import { runWithPrisma } from "@/lib/prisma";
import { connectMock } from "@/lib/meta/service";

export async function POST() {
  return runWithPrisma(async () => {
    const conn = await connectMock();
    return NextResponse.json({
      ok: true,
      mock: true,
      metaUserName: conn.metaUserName,
      accounts: conn.accounts.length,
    });
  });
}
