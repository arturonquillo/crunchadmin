import { NextRequest, NextResponse } from "next/server";
import { runWithPrisma } from "@/lib/prisma";
import { getHierarchy } from "@/lib/meta/service";
import type { DatePreset } from "@/lib/meta/types";

export async function GET(req: NextRequest) {
  return runWithPrisma(async () => {
    const sp = req.nextUrl.searchParams;
    const raw = sp.get("date_preset") || "last_7d";
    const preset = (
      ["today", "last_7d", "last_30d", "custom"].includes(raw) ? raw : "last_7d"
    ) as DatePreset;
    const since = sp.get("since") || undefined;
    const until = sp.get("until") || undefined;
    try {
      const data = await getHierarchy(preset, since, until);
      return NextResponse.json(data);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Error" },
        { status: 400 }
      );
    }
  });
}
