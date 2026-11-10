import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSiteSettings, sanitizeSitePatch } from "@/lib/site";

export async function GET() {
  return NextResponse.json(await getSiteSettings());
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { data, error } = sanitizeSitePatch(body);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No hay cambios" }, { status: 400 });
  }

  await getSiteSettings();
  const settings = await prisma.siteSettings.update({
    where: { id: "default" },
    data,
  });
  return NextResponse.json(settings);
}
