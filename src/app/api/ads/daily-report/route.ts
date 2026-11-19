import { NextRequest, NextResponse } from "next/server";
import { runWithPrisma } from "@/lib/prisma";
import { buildDailyReport } from "@/lib/meta/daily-report";

export async function GET(req: NextRequest) {
  return runWithPrisma(async () => {
    const date = req.nextUrl.searchParams.get("date") || undefined;
    try {
      const report = await buildDailyReport(date);
      return NextResponse.json(report);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Error" },
        { status: 400 }
      );
    }
  });
}
