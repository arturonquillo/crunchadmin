import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
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
  return NextResponse.json(receta);
}

/** Create a new version from provided lines (versioning) */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const receta = await prisma.receta.findUnique({
    where: { id },
    include: { versions: { orderBy: { number: "desc" }, take: 1 } },
  });
  if (!receta) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  const body = await req.json();
  const nextNumber = (receta.versions[0]?.number ?? 0) + 1;
  const lines = Array.isArray(body.lines) ? body.lines : [];

  const version = await prisma.recetaVersion.create({
    data: {
      recetaId: id,
      number: nextNumber,
      label: body.label || `v${nextNumber}`,
      changelog: body.changelog || null,
      lines: {
        create: lines.map(
          (
            l: {
              name: string;
              quantity?: number | null;
              unit?: string | null;
              isToTaste?: boolean;
            },
            i: number
          ) => ({
            name: String(l.name),
            quantity: l.quantity != null ? Number(l.quantity) : null,
            unit: l.unit ? String(l.unit) : null,
            isToTaste: Boolean(l.isToTaste),
            canBeScaleBase: !l.isToTaste,
            sortOrder: i + 1,
          })
        ),
      },
    },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });

  if (body.publish !== false) {
    await prisma.receta.update({
      where: { id },
      data: {
        currentVersionId: version.id,
        notes: body.notes !== undefined ? body.notes : undefined,
        yieldQty: body.yieldQty !== undefined ? body.yieldQty : undefined,
        yieldUnit: body.yieldUnit !== undefined ? body.yieldUnit : undefined,
        yieldLabel: body.yieldLabel !== undefined ? body.yieldLabel : undefined,
      },
    });
  }

  return NextResponse.json(version, { status: 201 });
}
