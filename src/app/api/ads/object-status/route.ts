import { NextRequest, NextResponse } from "next/server";
import { runWithPrisma } from "@/lib/prisma";
import { setObjectStatus } from "@/lib/meta/service";

export async function POST(req: NextRequest) {
  return runWithPrisma(async () => {
    const body = await req.json().catch(() => ({}));
    const objectId = String(body.objectId || "").trim();
    const status = String(body.status || "").toUpperCase();
    if (!objectId || (status !== "ACTIVE" && status !== "PAUSED")) {
      return NextResponse.json(
        { error: "objectId y status ACTIVE|PAUSED requeridos" },
        { status: 400 }
      );
    }
    try {
      const result = await setObjectStatus(objectId, status);
      return NextResponse.json(result);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Error" },
        { status: 400 }
      );
    }
  });
}
