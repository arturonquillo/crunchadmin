import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const items = await prisma.menuItem.findMany({
    orderBy: { name: "asc" },
    include: {
      platformSpecs: true,
      receta: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(items);
}
