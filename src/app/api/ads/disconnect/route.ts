import { NextResponse } from "next/server";
import { runWithPrisma } from "@/lib/prisma";
import { disconnectMeta } from "@/lib/meta/service";

export async function POST() {
  return runWithPrisma(async () => {
    await disconnectMeta();
    return NextResponse.json({ ok: true });
  });
}
