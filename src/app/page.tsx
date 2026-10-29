import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isOpenAIConfigured } from "@/lib/openai";
import { isAuthConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [pendientesAbiertos, recetas, menuItems, reminders] = await Promise.all([
    prisma.pendiente.count({ where: { estado: { not: "HECHO" } } }),
    prisma.receta.count(),
    prisma.menuItem.count(),
    prisma.reminder.count({ where: { dismissed: false } }),
  ]);

  return (
    <>
      <section className="hero-admin">
        <h1>Crunchadmin</h1>
        <p>
          Centro operativo del restaurante: pendientes, fichas técnicas con
          escalado, menú por canal y asistente. MVP listo para uso local.
        </p>
        <div className="form-actions">
          <Link className="btn" href="/recetas">
            Abrir recetas
          </Link>
          <Link className="btn secondary" href="/pendientes">
            Ver pendientes
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
            Auth:{" "}
            {isAuthConfigured()
              ? "variables detectadas"
              : "modo single-operator (sin login)"}
          </li>
          <li>Base de datos: SQLite local (ver DATABASE_URL)</li>
        </ul>
      </section>
    </>
  );
}
