import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req, { mutate: false });
  if (denied) return denied;

  const items = await prisma.menuItem.findMany({
    orderBy: { name: "asc" },
    include: {
      platformSpecs: true,
      receta: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(items);
}
