import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidQrCode, normalizeDestination, normalizeQrCode } from "@/lib/qr";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function html(status: number, title: string, message: string) {
  const body = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f3f0e8; color: #1a2218; font-family: Georgia, serif; }
    main { max-width: 28rem; padding: 2rem 1.25rem; text-align: center; }
    h1 { font-size: 1.8rem; margin: 0 0 0.6rem; }
    p { margin: 0; font-family: "Segoe UI", sans-serif; color: #3d4a38; line-height: 1.45; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
  </main>
</body>
</html>`;
  return new NextResponse(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

async function lookup(code: string) {
  const normalized = normalizeQrCode(code);
  if (!isValidQrCode(normalized)) return null;
  return prisma.qrCode.findUnique({ where: { code: normalized } });
}

function redirectTo(url: string) {
  return NextResponse.redirect(url, {
    status: 302,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
    },
  });
}

export async function HEAD(_req: NextRequest, ctx: Ctx) {
  const { code } = await ctx.params;
  const qr = await lookup(code);
  if (!qr || !qr.active) return new NextResponse(null, { status: 404 });
  const destination = normalizeDestination(qr.destinationUrl);
  if (!destination.ok) return new NextResponse(null, { status: 404 });
  return redirectTo(destination.url);
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { code } = await ctx.params;
  const qr = await lookup(code);
  if (!qr) {
    return html(404, "Código no encontrado", "Este QR no está dado de alta.");
  }
  if (!qr.active) {
    return html(
      200,
      "Enlace en pausa",
      "Este código está pausado. Vuelve a intentar más tarde."
    );
  }

  const destination = normalizeDestination(qr.destinationUrl);
  if (!destination.ok) {
    return html(404, "Destino no disponible", "Este código no tiene un destino válido.");
  }

  try {
    const userAgent = (req.headers.get("user-agent") || "").slice(0, 300);
    await prisma.$transaction([
      prisma.qrCode.update({
        where: { id: qr.id },
        data: { scanCount: { increment: 1 }, lastScannedAt: new Date() },
      }),
      prisma.qrScan.create({
        data: { qrCodeId: qr.id, userAgent: userAgent || null },
      }),
    ]);
  } catch (error) {
    console.error("No se pudo registrar la lectura del QR", error);
  }

  return redirectTo(destination.url);
}
