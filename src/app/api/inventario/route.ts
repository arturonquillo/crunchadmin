import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const items = await prisma.insumo.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const baseUnit = String(body.baseUnit ?? "").trim();
  if (!name || !baseUnit) {
    return NextResponse.json(
      { error: "Nombre y unidad base son obligatorios" },
      { status: 400 }
    );
  }

  const quantityOnHand = Number(body.quantityOnHand ?? 0);
  const minQty =
    body.minQty === "" || body.minQty == null ? null : Number(body.minQty);

  const item = await prisma.insumo.create({
    data: {
      name,
      baseUnit,
      quantityOnHand: Number.isFinite(quantityOnHand) ? quantityOnHand : 0,
      minQty: minQty != null && Number.isFinite(minQty) ? minQty : null,
      reorderHint: body.reorderHint ? String(body.reorderHint) : null,
      purchaseNotes: body.purchaseNotes ? String(body.purchaseNotes) : null,
    },
  });

  if (item.quantityOnHand !== 0) {
    await prisma.inventoryMovement.create({
      data: {
        insumoId: item.id,
        kind: "AJUSTE",
        delta: item.quantityOnHand,
        note: "Stock inicial",
      },
    });
  }

  return NextResponse.json(item, { status: 201 });
}
