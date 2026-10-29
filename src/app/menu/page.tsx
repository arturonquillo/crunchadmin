"use client";

import { useEffect, useMemo, useState } from "react";
import { PLATAFORMA_LABEL, type Plataforma } from "@/lib/labels";

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
  const [items, setItems] = useState<MenuItem[]>([]);
  const [tab, setTab] = useState<Plataforma | "TODAS">("TODAS");

  useEffect(() => {
    fetch("/api/menu")
      .then((r) => r.json())
      .then(setItems)
      .catch(console.error);
  }, []);

  const platforms: Plataforma[] = ["FOODIE", "TIENDA_PROPIA"];

  const filtered = useMemo(() => {
    if (tab === "TODAS") return items;
    return items.filter((i) =>
      i.platformSpecs.some((s) => s.platform === tab && s.available)
    );
  }, [items, tab]);

  return (
    <>
      <h1 className="section-title">Menú</h1>
      <p className="section-sub">
        Menú base con especificaciones por plataforma. Pestañas: Foodie y tienda
        propia.
      </p>

      <div className="tabs" role="tablist">
        <button
          type="button"
          className={tab === "TODAS" ? "tab active" : "tab"}
          onClick={() => setTab("TODAS")}
        >
          Todas
        </button>
        {platforms.map((p) => (
          <button
            key={p}
            type="button"
            className={tab === p ? "tab active" : "tab"}
            onClick={() => setTab(p)}
          >
            {PLATAFORMA_LABEL[p]}
          </button>
        ))}
      </div>

      <section className="panel">
        {filtered.length === 0 ? (
          <p className="empty">Sin ítems de menú.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Ítem base</th>
                  <th>Receta</th>
                  {platforms.map((p) => (
                    <th key={p}>{PLATAFORMA_LABEL[p]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      {item.description && (
                        <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                          {item.description}
                        </div>
                      )}
                    </td>
                    <td>{item.receta?.name ?? "—"}</td>
                    {platforms.map((p) => {
                      const spec = item.platformSpecs.find(
                        (s) => s.platform === p
                      );
                      if (!spec) {
                        return (
                          <td key={p}>
                            <span className="empty">Sin spec</span>
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
                            {spec.price != null ? `$${spec.price}` : "—"} ·{" "}
                            {spec.available ? (
                              <span className="badge">Disponible</span>
                            ) : (
                              <span className="badge warn">No disponible</span>
                            )}
                          </div>
                          {spec.channelNotes && (
                            <div
                              style={{
                                color: "var(--muted)",
                                fontSize: "0.8rem",
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
    </>
  );
}
