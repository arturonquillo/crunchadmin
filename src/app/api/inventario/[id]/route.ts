import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await req.json();
  const existing = await prisma.insumo.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const data: {
    name?: string;
    baseUnit?: string;
    category?: string;
    quantityOnHand?: number;
    packSize?: number | null;
    minQty?: number | null;
    reorderHint?: string | null;
    purchaseNotes?: string | null;
    fifoNote?: string | null;
  } = {};

  if (body.name != null) data.name = String(body.name).trim();
  if (body.baseUnit != null) data.baseUnit = String(body.baseUnit).trim();
  if (body.category != null) data.category = String(body.category);
  if (body.reorderHint !== undefined) {
    data.reorderHint = body.reorderHint ? String(body.reorderHint) : null;
  }
  if (body.purchaseNotes !== undefined) {
    data.purchaseNotes = body.purchaseNotes ? String(body.purchaseNotes) : null;
  }
  if (body.fifoNote !== undefined) {
    data.fifoNote = body.fifoNote ? String(body.fifoNote) : null;
  }
  if (body.minQty !== undefined) {
    data.minQty =
      body.minQty === "" || body.minQty == null ? null : Number(body.minQty);
  }
  if (body.packSize !== undefined) {
    data.packSize =
      body.packSize === "" || body.packSize == null
        ? null
        : Number(body.packSize);
  }

  let delta: number | null = null;
  let moveKind = "AJUSTE";
  if (body.quantityOnHand != null) {
    const next = Number(body.quantityOnHand);
    if (!Number.isFinite(next)) {
      return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });
    }
    data.quantityOnHand = next;
    delta = next - existing.quantityOnHand;
  } else if (body.delta != null) {
    const d = Number(body.delta);
    if (!Number.isFinite(d)) {
      return NextResponse.json({ error: "Delta inválido" }, { status: 400 });
    }
    data.quantityOnHand = existing.quantityOnHand + d;
    delta = d;
    moveKind = body.kind ? String(body.kind) : "AJUSTE";
  }

  const item = await prisma.insumo.update({ where: { id }, data });

  if (delta != null && delta !== 0) {
    await prisma.inventoryMovement.create({
      data: {
        insumoId: id,
        kind: moveKind,
        delta,
        note: body.note ? String(body.note) : null,
      },
    });
  }

  return NextResponse.json(item);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  await prisma.inventoryMovement.deleteMany({ where: { insumoId: id } });
  await prisma.insumo.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
