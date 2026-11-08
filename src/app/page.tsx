import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { isOpenAIConfigured } from "@/lib/openai";
import { isAuthConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const t = await getTranslations("Home");
  const [pendientesAbiertos, recetas, menuItems, reminders] = await Promise.all([
    prisma.pendiente.count({ where: { estado: { not: "HECHO" } } }),
    prisma.receta.count(),
    prisma.menuItem.count(),
    prisma.reminder.count({ where: { dismissed: false } }),
  ]);

  return (
    <>
      <section className="hero-admin">
        <h1>{t("brand")}</h1>
        <p>{t("lead")}</p>
        <div className="form-actions">
          <Link className="btn" href="/recetas">
            {t("openRecipes")}
          </Link>
          <Link className="btn secondary" href="/pendientes">
            {t("viewPendientes")}
          </Link>
        </div>
      </section>

      <div className="grid-stats">
        <div className="stat">
          <strong>{pendientesAbiertos}</strong>
          <span>{t("statOpenPendientes")}</span>
        </div>
        <div className="stat">
          <strong>{recetas}</strong>
          <span>{t("statRecetas")}</span>
        </div>
        <div className="stat">
          <strong>{menuItems}</strong>
          <span>{t("statMenuItems")}</span>
        </div>
        <div className="stat">
          <strong>{reminders}</strong>
          <span>{t("statReminders")}</span>
        </div>
      </div>

      <section className="panel" style={{ marginTop: "1.25rem" }}>
        <h2 className="section-title" style={{ fontSize: "1.25rem" }}>
          {t("envTitle")}
        </h2>
        <ul
          style={{
            margin: "0.75rem 0 0",
            paddingLeft: "1.1rem",
            color: "var(--ink-soft)",
          }}
        >
          <li>
            {t("openaiLabel")}:{" "}
            {isOpenAIConfigured() ? t("openaiConfigured") : t("openaiStub")}
          </li>
          <li>
            {t("authLabel")}:{" "}
            {isAuthConfigured() ? t("authConfigured") : t("authSingle")}
          </li>
          <li>{t("dbLocal")}</li>
        </ul>
      </section>
    </>
  );
}
