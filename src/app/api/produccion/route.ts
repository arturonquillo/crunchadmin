import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { previewProduction } from "@/lib/production";
import { ScaleError } from "@/lib/scaling";

export async function GET() {
  const prisma = await getPrisma();

  const items = await prisma.produccion.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      receta: { select: { id: true, name: true } },
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const prisma = await getPrisma();

  const body = await req.json();
  const recetaId = String(body.recetaId ?? "");
  const force = Boolean(body.force);

  const receta = await prisma.receta.findUnique({
    where: { id: recetaId },
    include: {
      versions: {
        orderBy: { number: "desc" },
        include: {
          lines: {
            orderBy: { sortOrder: "asc" },
            include: { insumo: true },
          },
        },
      },
    },
  });
  if (!receta) {
    return NextResponse.json({ error: "Receta no encontrada" }, { status: 404 });
  }

  const version =
    receta.versions.find((v) => v.id === (body.versionId || receta.currentVersionId)) ||
    receta.versions[0];
  if (!version) {
    return NextResponse.json({ error: "Sin versiones" }, { status: 400 });
  }

  let preview;
  try {
    preview = previewProduction({
      lines: version.lines.map((l) => ({
        id: l.id,
        name: l.name,
        quantity: l.quantity,
        unit: l.unit,
        isToTaste: l.isToTaste,
        canBeScaleBase: l.canBeScaleBase,
        insumoId: l.insumoId,
        insumo: l.insumo,
      })),
      yield:
        receta.yieldQty != null && receta.yieldUnit
          ? {
              quantity: receta.yieldQty,
              unit: receta.yieldUnit,
              label: receta.yieldLabel,
            }
          : null,
      baseKind: body.baseKind === "yield" ? "yield" : "line",
      baseLineId: body.baseLineId,
      targetQuantity: Number(body.targetQuantity),
      targetUnit: body.targetUnit,
    });
  } catch (e) {
    if (e instanceof ScaleError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }

  if (!preview.canConfirm && !force) {
    return NextResponse.json(
      {
        error: "Inventario insuficiente",
        preview,
      },
      { status: 409 }
    );
  }

  const title =
    body.title?.trim() ||
    `${receta.name} — ${preview.scale.targetQuantity} ${
      body.targetUnit || preview.scale.baseUnit
    }`;

  const result = await prisma.$transaction(async (tx) => {
    const produccion = await tx.produccion.create({
      data: {
        recetaId: receta.id,
        versionId: version.id,
        title,
        baseKind: body.baseKind === "yield" ? "yield" : "line",
        baseLineId: body.baseLineId || null,
        baseName: preview.scale.baseName,
        targetQuantity: preview.scale.targetQuantity,
        targetUnit: body.targetUnit || preview.scale.baseUnit,
        factor: preview.scale.factor,
        status: "CONFIRMADA",
        notes: body.notes ? String(body.notes) : null,
        missingJson:
          preview.missing.length > 0 ? JSON.stringify(preview.missing) : null,
      },
    });

    let sort = 0;
    for (const line of preview.lines) {
      let deductedQty: number | null = null;
      let onHandBefore: number | null = null;
      let onHandAfter: number | null = null;
      let insufficient = false;

      if (line.insumoId && line.needInBase != null && line.needInBase > 0) {
        const insumo = await tx.insumo.findUnique({ where: { id: line.insumoId } });
        if (insumo) {
          onHandBefore = insumo.quantityOnHand;
          const deduct = Math.min(insumo.quantityOnHand, line.needInBase);
          insufficient = insumo.quantityOnHand + 1e-9 < line.needInBase;
          const next = Math.round((insumo.quantityOnHand - deduct) * 10000) / 10000;
          await tx.insumo.update({
            where: { id: insumo.id },
            data: { quantityOnHand: next },
          });
          deductedQty = deduct;
          onHandAfter = next;
          if (deduct > 0) {
            await tx.inventoryMovement.create({
              data: {
                insumoId: insumo.id,
                kind: "PRODUCCION",
                delta: -deduct,
                note: title,
                refId: produccion.id,
              },
            });
          }
        }
      }

      await tx.produccionLinea.create({
        data: {
          produccionId: produccion.id,
          name: line.name,
          quantity: line.quantity,
          unit: line.unit,
          insumoId: line.insumoId,
          deductedQty,
          onHandBefore,
          onHandAfter,
          insufficient,
          sortOrder: sort++,
        },
      });
    }

    return tx.produccion.findUnique({
      where: { id: produccion.id },
      include: {
        receta: { select: { id: true, name: true } },
        lines: { orderBy: { sortOrder: "asc" } },
      },
    });
  });

  return NextResponse.json({ produccion: result, preview }, { status: 201 });
}
