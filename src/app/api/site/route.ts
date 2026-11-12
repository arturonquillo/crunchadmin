import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { getSiteSettings, sanitizeSitePatch } from "@/lib/site";

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req, { mutate: false });
  if (denied) return denied;
  return NextResponse.json(await getSiteSettings());
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

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
