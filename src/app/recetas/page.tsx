"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Receta = {
  id: string;
  name: string;
  notes: string | null;
  yieldQty: number | null;
  yieldUnit: string | null;
  yieldLabel: string | null;
  versions: { id: string; number: number; label: string | null }[];
};

export default function RecetasPage() {
  const t = useTranslations("Recetas");
  const tc = useTranslations("Common");
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [name, setName] = useState("");
  const [yieldQty, setYieldQty] = useState("1");
  const [yieldUnit, setYieldUnit] = useState("kg");
  const [yieldLabel, setYieldLabel] = useState("");
  const [linesText, setLinesText] = useState(
    "Aceite,700,g\nYema,150,g\nMostaza,50,g\nVinagre,80,g\nSal,20,g\nPimienta,,,"
  );
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/recetas");
    setRecetas(await res.json());
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const lines = linesText
      .split("\n")
      .map((row) => row.trim())
      .filter(Boolean)
      .map((row) => {
        const [n, qty, unit, taste] = row.split(",").map((s) => s.trim());
        const isToTaste = taste === "gusto" || (!qty && !unit);
        return {
          name: n,
          quantity: qty ? Number(qty) : null,
          unit: unit || null,
          isToTaste,
        };
      });

    const res = await fetch("/api/recetas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        yieldQty: yieldQty ? Number(yieldQty) : null,
        yieldUnit: yieldUnit || null,
        yieldLabel: yieldLabel || null,
        lines,
      }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || tc("error"));
      return;
    }
    setName("");
    await load();
  }

  return (
    <>
      <h1 className="section-title">{t("title")}</h1>
      <p className="section-sub">{t("subtitle")}</p>

      <section className="panel">
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>{t("newTitle")}</h2>
        <form onSubmit={onCreate}>
          <div className="form-grid">
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="rname">{t("fieldName")}</label>
              <input
                id="rname"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="yq">{t("fieldYield")}</label>
              <input
                id="yq"
                type="number"
                step="any"
                value={yieldQty}
                onChange={(e) => setYieldQty(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="yu">{t("fieldUnit")}</label>
              <input
                id="yu"
                value={yieldUnit}
                onChange={(e) => setYieldUnit(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="yl">{t("fieldYieldLabel")}</label>
              <input
                id="yl"
                placeholder={t("yieldPlaceholder")}
                value={yieldLabel}
                onChange={(e) => setYieldLabel(e.target.value)}
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="lines">{t("fieldLines")}</label>
              <textarea
                id="lines"
                value={linesText}
                onChange={(e) => setLinesText(e.target.value)}
                style={{ minHeight: 120, fontFamily: "ui-monospace, monospace" }}
              />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn" type="submit">
              {t("create")}
            </button>
          </div>
        </form>
        {error && (
          <p style={{ color: "var(--danger)", marginTop: "0.75rem" }}>{error}</p>
        )}
      </section>

      <section className="panel">
        {recetas.length === 0 ? (
          <p className="empty">{t("empty")}</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t("colName")}</th>
                  <th>{t("colYield")}</th>
                  <th>{t("colVersions")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recetas.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {/* User content — keep original language */}
                      <strong>{r.name}</strong>
                      {r.notes && (
                        <div
                          style={{ color: "var(--muted)", fontSize: "0.85rem" }}
                        >
                          {r.notes}
                        </div>
                      )}
                    </td>
                    <td>
                      {r.yieldQty != null
                        ? `${r.yieldQty} ${r.yieldUnit ?? ""} ${r.yieldLabel ? `(${r.yieldLabel})` : ""}`
                        : tc("dash")}
                    </td>
                    <td>{r.versions.length}</td>
                    <td>
                      <Link className="btn secondary" href={`/recetas/${r.id}`}>
                        {t("openScale")}
                      </Link>
                    </td>
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
