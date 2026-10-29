import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const recetas = await prisma.receta.findMany({
    orderBy: { name: "asc" },
    include: {
      versions: {
        orderBy: { number: "desc" },
        include: { lines: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  return NextResponse.json(recetas);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }

  const lines = Array.isArray(body.lines) ? body.lines : [];

  const receta = await prisma.receta.create({
    data: {
      name,
      notes: body.notes ? String(body.notes) : null,
      yieldQty: body.yieldQty != null ? Number(body.yieldQty) : null,
      yieldUnit: body.yieldUnit ? String(body.yieldUnit) : null,
      yieldLabel: body.yieldLabel ? String(body.yieldLabel) : null,
      versions: {
        create: {
          number: 1,
          label: body.versionLabel || "v1",
          changelog: body.changelog || "Versión inicial",
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
      },
    },
    include: { versions: { include: { lines: true } } },
  });

  const versionId = receta.versions[0]?.id;
  if (versionId) {
    await prisma.receta.update({
      where: { id: receta.id },
      data: { currentVersionId: versionId },
    });
  }

  const full = await prisma.receta.findUnique({
    where: { id: receta.id },
    include: {
      versions: {
        orderBy: { number: "desc" },
        include: { lines: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  return NextResponse.json(full, { status: 201 });
}
