import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CATEGORIAS, ESTADOS, PRIORIDADES } from "@/lib/labels";
import { isRestaurantZone } from "@/lib/zones";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.title != null) data.title = String(body.title).trim();
  if (body.description !== undefined) {
    data.description = body.description ? String(body.description) : null;
  }
  if (body.categoria != null) {
    if (!CATEGORIAS.includes(body.categoria)) {
      return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
    }
    data.categoria = body.categoria;
  }
  if (body.estado != null) {
    if (!ESTADOS.includes(body.estado)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }
    data.estado = body.estado;
  }
  if (body.prioridad != null) {
    if (!PRIORIDADES.includes(body.prioridad)) {
      return NextResponse.json({ error: "Prioridad inválida" }, { status: 400 });
    }
    data.prioridad = body.prioridad;
  }
  if (body.zone != null) {
    if (!isRestaurantZone(body.zone)) {
      return NextResponse.json({ error: "Zona inválida" }, { status: 400 });
    }
    data.zone = body.zone;
  }
  if (body.anchorHint !== undefined) {
    data.anchorHint = body.anchorHint ? String(body.anchorHint) : null;
  }
  if (body.dueDate !== undefined) {
    data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  }

  try {
    const item = await prisma.pendiente.update({ where: { id }, data });
    return NextResponse.json(item);
  } catch {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    await prisma.pendiente.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
}
