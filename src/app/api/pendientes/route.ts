import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CATEGORIAS, ESTADOS, PRIORIDADES } from "@/lib/labels";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const categoria = searchParams.get("categoria");
  const estado = searchParams.get("estado");

  const items = await prisma.pendiente.findMany({
    where: {
      ...(categoria ? { categoria } : {}),
      ...(estado ? { estado } : {}),
    },
    orderBy: [{ prioridad: "desc" }, { createdAt: "desc" }],
    include: { insumo: true, receta: true },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const title = String(body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "El título es obligatorio" }, { status: 400 });
  }
  const categoria = String(body.categoria ?? "COMPRAS");
  const estado = String(body.estado ?? "PENDIENTE");
  const prioridad = String(body.prioridad ?? "MEDIA");
  if (!CATEGORIAS.includes(categoria as never)) {
    return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
  }
  if (!ESTADOS.includes(estado as never)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }
  if (!PRIORIDADES.includes(prioridad as never)) {
    return NextResponse.json({ error: "Prioridad inválida" }, { status: 400 });
  }

  const item = await prisma.pendiente.create({
    data: {
      title,
      description: body.description ? String(body.description) : null,
      categoria,
      estado,
      prioridad,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      insumoId: body.insumoId || null,
      recetaId: body.recetaId || null,
    },
  });
  return NextResponse.json(item, { status: 201 });
}
