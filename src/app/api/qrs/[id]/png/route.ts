import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { publicQrUrl } from "@/lib/qr";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const qr = await prisma.qrCode.findUnique({ where: { id } });
  if (!qr) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const png = await QRCode.toBuffer(publicQrUrl(qr.code), {
    type: "png",
    width: 1024,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: "#111111", light: "#ffffff" },
  });

  const download = req.nextUrl.searchParams.get("download") === "1";
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=3600",
      ...(download
        ? {
            "Content-Disposition": `attachment; filename="lecrunch-qr-${qr.code}.png"`,
          }
        : {}),
    },
  });
}
