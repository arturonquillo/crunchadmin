import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  describeAgent,
  fillDailyCounts,
  normalizeDestination,
  publicQrUrl,
} from "@/lib/qr";

type Ctx = { params: Promise<{ id: string }> };

function withShortUrl<T extends { code: string }>(qr: T) {
  return { ...qr, shortUrl: publicQrUrl(qr.code) };
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const qr = await prisma.qrCode.findUnique({
    where: { id },
    include: {
      changes: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!qr) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const since = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
  const [latest, stamps] = await Promise.all([
    prisma.qrScan.findMany({
      where: { qrCodeId: id },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { id: true, createdAt: true, userAgent: true },
    }),
    prisma.qrScan.findMany({
      where: { qrCodeId: id, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
  ]);

  return NextResponse.json({
    ...withShortUrl(qr),
    latestScans: latest.map((scan) => ({
      id: scan.id,
      createdAt: scan.createdAt,
      agent: describeAgent(scan.userAgent),
    })),
    daily: fillDailyCounts(
      stamps.map((stamp) => stamp.createdAt),
      14
    ),
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const current = await prisma.qrCode.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const data: {
    name?: string;
    notes?: string | null;
    active?: boolean;
    destinationUrl?: string;
  } = {};

  if (body.name != null) {
    const name = String(body.name).trim();
    if (!name || name.length > 80) {
      return NextResponse.json(
        { error: "El nombre es obligatorio (máximo 80 caracteres)" },
        { status: 400 }
      );
    }
    data.name = name;
  }

  if (body.notes !== undefined) {
    const notes = body.notes == null ? "" : String(body.notes).trim();
    if (notes.length > 500) {
      return NextResponse.json(
        { error: "Las notas superan los 500 caracteres" },
        { status: 400 }
      );
    }
    data.notes = notes || null;
  }

  if (body.active != null) data.active = Boolean(body.active);

  let destinationChange: { fromUrl: string; toUrl: string } | null = null;
  if (body.destinationUrl != null) {
    const destination = normalizeDestination(String(body.destinationUrl));
    if (!destination.ok) {
      return NextResponse.json({ error: destination.error }, { status: 400 });
    }
    if (destination.url !== current.destinationUrl) {
      data.destinationUrl = destination.url;
      destinationChange = { fromUrl: current.destinationUrl, toUrl: destination.url };
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(withShortUrl(current));
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.qrCode.update({ where: { id }, data });
    if (destinationChange) {
      await tx.qrDestinationChange.create({
        data: { qrCodeId: id, ...destinationChange },
      });
    }
    return next;
  });

  return NextResponse.json(withShortUrl(updated));
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    await prisma.qrCode.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
}
