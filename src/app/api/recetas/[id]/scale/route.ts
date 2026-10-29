import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scaleRecipe, ScaleError } from "@/lib/scaling";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await req.json();

  const receta = await prisma.receta.findUnique({
    where: { id },
    include: {
      versions: {
        orderBy: { number: "desc" },
        include: { lines: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!receta) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  const version =
    receta.versions.find((v) => v.id === (body.versionId || receta.currentVersionId)) ||
    receta.versions[0];
  if (!version) {
    return NextResponse.json({ error: "Sin versiones" }, { status: 400 });
  }

  try {
    const result = scaleRecipe({
      lines: version.lines.map((l) => ({
        id: l.id,
        name: l.name,
        quantity: l.quantity,
        unit: l.unit,
        isToTaste: l.isToTaste,
        canBeScaleBase: l.canBeScaleBase,
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
      recetaId: receta.id,
      versionId: version.id,
      ...result,
    });
  } catch (e) {
    if (e instanceof ScaleError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}
