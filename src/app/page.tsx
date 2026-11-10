import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isOpenAIConfigured } from "@/lib/openai";
import { isAuthConfigured } from "@/lib/auth";
import { adminAuthEnabled } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [pendientesAbiertos, recetas, menuItems, reminders, qrCodes, qrScans] =
    await Promise.all([
      prisma.pendiente.count({ where: { estado: { not: "HECHO" } } }),
      prisma.receta.count(),
      prisma.menuItem.count(),
      prisma.reminder.count({ where: { dismissed: false } }),
      prisma.qrCode.count(),
      prisma.qrScan.count(),
    ]);

  return (
    <>
      <section className="hero-admin">
        <h1>Crunchadmin</h1>
        <p>
          Centro operativo del restaurante: pendientes, fichas técnicas con
          escalado, menú por canal, códigos QR y datos del sitio.
        </p>
        <div className="form-actions">
          <Link className="btn" href="/qrs">
            Crear código QR
          </Link>
          <Link className="btn secondary" href="/sitio">
            Editar sitio
          </Link>
        </div>
      </section>

      <div className="grid-stats">
        <div className="stat">
          <strong>{pendientesAbiertos}</strong>
          <span>Pendientes abiertos</span>
        </div>
        <div className="stat">
          <strong>{recetas}</strong>
          <span>Recetas</span>
        </div>
        <div className="stat">
          <strong>{menuItems}</strong>
          <span>Ítems de menú</span>
        </div>
        <div className="stat">
          <strong>{reminders}</strong>
          <span>Recordatorios (stub)</span>
        </div>
        <div className="stat">
          <strong>{qrCodes}</strong>
          <span>Códigos QR</span>
        </div>
        <div className="stat">
          <strong>{qrScans}</strong>
          <span>Lecturas de QR</span>
        </div>
      </div>

      <section className="panel" style={{ marginTop: "1.25rem" }}>
        <h2 className="section-title" style={{ fontSize: "1.25rem" }}>
          Estado del entorno
        </h2>
        <ul style={{ margin: "0.75rem 0 0", paddingLeft: "1.1rem", color: "var(--ink-soft)" }}>
          <li>
            OpenAI:{" "}
            {isOpenAIConfigured()
              ? "configurado"
              : "stub activo (sin OPENAI_API_KEY)"}
          </li>
          <li>
            Acceso al panel:{" "}
            {adminAuthEnabled()
              ? "contraseña activa"
              : "abierto hasta definir ADMIN_PASSWORD"}
          </li>
          <li>
            Auth externa:{" "}
            {isAuthConfigured()
              ? "variables detectadas"
              : "sin NextAuth, Clerk ni Supabase"}
          </li>
          <li>Base de datos: SQLite local (ver DATABASE_URL)</li>
        </ul>
      </section>
    </>
  );
}
