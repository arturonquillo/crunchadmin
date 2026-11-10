import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { prisma } from "@/lib/prisma";
import { publicQrUrl } from "@/lib/qr";

export const dynamic = "force-dynamic";

export default async function PrintQrPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const qr = await prisma.qrCode.findUnique({ where: { id } });
  if (!qr) notFound();

  return (
    <section className="print-sheet">
      <div className="no-print form-actions" style={{ marginTop: 0 }}>
        <Link className="btn secondary" href={`/qrs/${qr.id}`}>
          Volver
        </Link>
        <PrintButton />
      </div>
      {!qr.active && (
        <p className="notice warn no-print">Este código está en pausa. El impreso no va a redirigir.</p>
      )}
      <p className="print-brand">Le Crunch</p>
      <h1>{qr.name}</h1>
      <img src={`/api/qrs/${qr.id}/png`} alt="" width={1024} height={1024} />
      <p className="print-code">{publicQrUrl(qr.code).replace(/^https?:\/\//, "")}</p>
    </section>
  );
}
