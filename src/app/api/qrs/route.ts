import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateQrCode,
  isValidQrCode,
  normalizeDestination,
  normalizeQrCode,
  publicQrUrl,
} from "@/lib/qr";

function withShortUrl<T extends { code: string }>(qr: T) {
  return { ...qr, shortUrl: publicQrUrl(qr.code) };
}

export async function GET() {
  const items = await prisma.qrCode.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(items.map(withShortUrl));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  if (!name || name.length > 80) {
    return NextResponse.json(
      { error: "El nombre es obligatorio (máximo 80 caracteres)" },
      { status: 400 }
    );
  }

  const destination = normalizeDestination(String(body.destinationUrl ?? ""));
  if (!destination.ok) {
    return NextResponse.json({ error: destination.error }, { status: 400 });
  }

  const notesRaw = body.notes == null ? "" : String(body.notes).trim();
  if (notesRaw.length > 500) {
    return NextResponse.json(
      { error: "Las notas superan los 500 caracteres" },
      { status: 400 }
    );
  }

  const requested = body.code ? normalizeQrCode(String(body.code)) : "";
  if (requested && !isValidQrCode(requested)) {
    return NextResponse.json(
      { error: "El código debe tener entre 3 y 32 letras o números, sin espacios" },
      { status: 400 }
    );
  }

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = requested || generateQrCode();
    try {
      const created = await prisma.qrCode.create({
        data: {
          code,
          name,
          destinationUrl: destination.url,
          notes: notesRaw || null,
        },
      });
      return NextResponse.json(withShortUrl(created), { status: 201 });
    } catch (error) {
      const known = error as { code?: string };
      if (known.code === "P2002") {
        if (requested) {
          return NextResponse.json({ error: "Ese código ya existe" }, { status: 409 });
        }
        continue;
      }
      throw error;
    }
  }

  return NextResponse.json(
    { error: "No se pudo generar un código único" },
    { status: 500 }
  );
}
