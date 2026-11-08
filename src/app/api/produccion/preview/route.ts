import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { previewProduction } from "@/lib/production";
import { ScaleError } from "@/lib/scaling";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const recetaId = String(body.recetaId ?? "");

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

  try {
    const preview = previewProduction({
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

    return NextResponse.json({
      receta: { id: receta.id, name: receta.name },
      versionId: version.id,
      preview,
    });
  } catch (e) {
    if (e instanceof ScaleError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}
