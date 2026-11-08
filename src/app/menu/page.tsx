"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PLATAFORMAS, type Plataforma } from "@/lib/labels";

type Spec = {
  id: string;
  platform: Plataforma;
  displayName: string | null;
  price: number | null;
  available: boolean;
  channelNotes: string | null;
};

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  receta: { id: string; name: string } | null;
  platformSpecs: Spec[];
};

export default function MenuPage() {
  const t = useTranslations("Menu");
  const tc = useTranslations("Common");
  const tl = useTranslations("Labels");
  const [items, setItems] = useState<MenuItem[]>([]);
  const [tab, setTab] = useState<Plataforma | "TODAS">("TODAS");

  useEffect(() => {
    fetch("/api/menu")
      .then((r) => r.json())
      .then(setItems)
      .catch(console.error);
  }, []);

  const platforms = [...PLATAFORMAS];

  const filtered = useMemo(() => {
    if (tab === "TODAS") return items;
    return items.filter((i) =>
      i.platformSpecs.some((s) => s.platform === tab && s.available)
    );
  }, [items, tab]);

  return (
    <div className="shell">
      <h1 className="section-title">{t("title")}</h1>
      <p className="section-sub">{t("subtitle")}</p>

      <div className="tabs" role="tablist">
        <button
          type="button"
          className={tab === "TODAS" ? "tab active" : "tab"}
          onClick={() => setTab("TODAS")}
        >
          {tc("all")}
        </button>
        {platforms.map((p) => (
          <button
            key={p}
            type="button"
            className={tab === p ? "tab active" : "tab"}
            onClick={() => setTab(p)}
          >
            {tl(`plataforma.${p}`)}
          </button>
        ))}
      </div>

      <section className="panel">
        {filtered.length === 0 ? (
          <p className="empty">{t("empty")}</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t("colBase")}</th>
                  <th>{t("colRecipe")}</th>
                  {platforms.map((p) => (
                    <th key={p}>{tl(`plataforma.${p}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      {item.description && (
                        <div style={{ color: "var(--muted)", fontSize: "var(--text-sm)" }}>
                          {item.description}
                        </div>
                      )}
                    </td>
                    <td>{item.receta?.name ?? tc("dash")}</td>
                    {platforms.map((p) => {
                      const spec = item.platformSpecs.find(
                        (s) => s.platform === p
                      );
                      if (!spec) {
                        return (
                          <td key={p}>
                            <span className="empty">{t("noSpec")}</span>
                          </td>
                        );
                      }
                      const dim =
                        tab !== "TODAS" && tab !== p
                          ? { opacity: 0.45 }
                          : undefined;
                      return (
                        <td key={p} style={dim}>
                          <div>{spec.displayName || item.name}</div>
                          <div>
                            {spec.price != null ? `$${spec.price}` : tc("dash")}{" "}
                            ·{" "}
                            {spec.available ? (
                              <span className="badge">{t("available")}</span>
                            ) : (
                              <span className="badge warn">
                                {t("unavailable")}
                              </span>
                            )}
                          </div>
                          {spec.channelNotes && (
                            <div
                              style={{
                                color: "var(--muted)",
                                fontSize: "var(--text-sm)",
                                marginTop: 4,
                              }}
                            >
                              {spec.channelNotes}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
