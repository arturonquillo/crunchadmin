import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const items = await prisma.insumo.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: {
      recipeLines: {
        include: {
          version: {
            include: {
              receta: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  const shaped = items.map((item) => {
    const fichasMap = new Map<string, { id: string; name: string }>();
    for (const line of item.recipeLines) {
      const r = line.version.receta;
      if (r) fichasMap.set(r.id, r);
    }
    return {
      id: item.id,
      name: item.name,
      baseUnit: item.baseUnit,
      category: item.category,
      quantityOnHand: item.quantityOnHand,
      packSize: item.packSize,
      minQty: item.minQty,
      reorderHint: item.reorderHint,
      purchaseNotes: item.purchaseNotes,
      fifoNote: item.fifoNote,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      fichas: [...fichasMap.values()].sort((a, b) =>
        a.name.localeCompare(b.name, "es")
      ),
    };
  });

  return NextResponse.json(shaped);
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
  const packSize =
    body.packSize === "" || body.packSize == null
      ? null
      : Number(body.packSize);

  const item = await prisma.insumo.create({
    data: {
      name,
      baseUnit,
      category: body.category ? String(body.category) : "OTROS",
      quantityOnHand: Number.isFinite(quantityOnHand) ? quantityOnHand : 0,
      packSize: packSize != null && Number.isFinite(packSize) ? packSize : null,
      minQty: minQty != null && Number.isFinite(minQty) ? minQty : null,
      reorderHint: body.reorderHint ? String(body.reorderHint) : null,
      purchaseNotes: body.purchaseNotes ? String(body.purchaseNotes) : null,
      fifoNote: body.fifoNote ? String(body.fifoNote) : null,
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

  return NextResponse.json({ ...item, fichas: [] }, { status: 201 });
}
