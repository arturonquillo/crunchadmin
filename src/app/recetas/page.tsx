"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { FormSheet } from "@/components/FormSheet";

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
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [showForm, setShowForm] = useState(false);
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
      setError(d.error || "Error");
      return;
    }
    setName("");
    setShowForm(false);
    await load();
  }

  return (
    <div className="shell">
      <div className="page-head">
        <div>
          <h1 className="section-title">Recetas</h1>
          <p className="section-sub" style={{ marginBottom: 0 }}>
            Fichas técnicas con versiones. Abrí una para escalar.
          </p>
        </div>
        <div className="page-head-actions">
          <button type="button" className="btn" onClick={() => setShowForm(true)}>
            + Nueva
          </button>
        </div>
      </div>

      <section className="panel" style={{ marginTop: "0.85rem" }}>
        {recetas.length === 0 ? (
          <p className="empty">
            Sin recetas aún.{" "}
            <button type="button" className="btn ghost" onClick={() => setShowForm(true)}>
              Crear la primera
            </button>
          </p>
        ) : (
          <ul className="list-cards">
            {recetas.map((r) => (
              <li key={r.id} className="list-card">
                <div className="list-card-main">
                  <strong>{r.name}</strong>
                  <span className="list-card-meta">
                    {r.yieldQty != null
                      ? `${r.yieldQty} ${r.yieldUnit ?? ""}${r.yieldLabel ? ` · ${r.yieldLabel}` : ""}`
                      : "Sin rendimiento"}
                    {" · "}
                    {r.versions.length} vers.
                  </span>
                  {r.notes && <span className="list-card-note">{r.notes}</span>}
                </div>
                <Link className="btn secondary" href={`/recetas/${r.id}`}>
                  Abrir
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <FormSheet
        open={showForm}
        title="Nueva receta"
        kicker="Ficha técnica"
        onClose={() => setShowForm(false)}
      >
        <form onSubmit={onCreate}>
          <div className="form-grid">
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="rname">Nombre</label>
              <input
                id="rname"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="yq">Rendimiento</label>
              <input
                id="yq"
                type="number"
                step="any"
                value={yieldQty}
                onChange={(e) => setYieldQty(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="yu">Unidad</label>
              <input
                id="yu"
                value={yieldUnit}
                onChange={(e) => setYieldUnit(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="yl">Etiqueta yield</label>
              <input
                id="yl"
                placeholder="mayonesa"
                value={yieldLabel}
                onChange={(e) => setYieldLabel(e.target.value)}
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="lines">Líneas (nombre,cantidad,unidad[,gusto])</label>
              <textarea
                id="lines"
                value={linesText}
                onChange={(e) => setLinesText(e.target.value)}
                style={{ minHeight: 120, fontFamily: "ui-monospace, monospace" }}
              />
            </div>
          </div>
          {error && <p className="error">{error}</p>}
          <div className="form-actions">
            <button className="btn" type="submit">
              Crear receta
            </button>
          </div>
        </form>
      </FormSheet>
    </div>
  );
}
