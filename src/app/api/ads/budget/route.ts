import { NextRequest, NextResponse } from "next/server";
import { runWithPrisma } from "@/lib/prisma";
import { setAdsetDailyBudget } from "@/lib/meta/service";

export async function POST(req: NextRequest) {
  return runWithPrisma(async () => {
    const body = await req.json().catch(() => ({}));
    const adsetId = String(body.adsetId || "").trim();
    const dailyBudget = Number(body.dailyBudget);
    if (!adsetId || !(dailyBudget > 0)) {
      return NextResponse.json(
        {
          error:
            "adsetId y dailyBudget (unidades menores de moneda, p.ej. centavos) requeridos",
        },
        { status: 400 }
      );
    }
    try {
      const result = await setAdsetDailyBudget(adsetId, dailyBudget);
      return NextResponse.json(result);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Error" },
        { status: 400 }
      );
    }
  });
}
