import { NextRequest, NextResponse } from "next/server";
import { runWithPrisma } from "@/lib/prisma";
import { getConnectionStatus, selectAdAccount } from "@/lib/meta/service";

export async function GET() {
  return runWithPrisma(async () => {
    const status = await getConnectionStatus();
    return NextResponse.json({
      accounts: status.accounts,
      selectedAccount: status.selectedAccount,
      mock: status.mock,
    });
  });
}

export async function POST(req: NextRequest) {
  return runWithPrisma(async () => {
    const body = await req.json().catch(() => ({}));
    const actId = String(body.actId || "").trim();
    if (!actId) {
      return NextResponse.json({ error: "actId requerido" }, { status: 400 });
    }
    try {
      const selected = await selectAdAccount(actId);
      return NextResponse.json({ ok: true, selected });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Error" },
        { status: 400 }
      );
    }
  });
}
