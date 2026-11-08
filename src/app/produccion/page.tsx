"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type RecetaOpt = {
  id: string;
  name: string;
  yieldQty: number | null;
  yieldUnit: string | null;
  yieldLabel: string | null;
  currentVersionId: string | null;
  versions: {
    id: string;
    number: number;
    lines: {
      id: string;
      name: string;
      quantity: number | null;
      unit: string | null;
      isToTaste: boolean;
      canBeScaleBase: boolean;
      insumoId: string | null;
    }[];
  }[];
};

type PreviewLine = {
  lineId: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  scaled: boolean;
  available: boolean;
  onHand: number | null;
  onHandUnit: string | null;
  needInBase: number | null;
  missingQty: number | null;
  reason?: string;
};

type Preview = {
  canConfirm: boolean;
  hasWarnings: boolean;
  missing: { name: string; missingQty: number; unit: string }[];
  scale: {
    factor: number;
    baseName: string;
    targetQuantity: number;
    scaledYield: { quantity: number; unit: string; label: string | null } | null;
  };
  lines: PreviewLine[];
};

type HistoryItem = {
  id: string;
  title: string;
  createdAt: string;
  factor: number;
  baseName: string;
  targetQuantity: number;
  targetUnit: string;
  receta: { name: string };
  missingJson: string | null;
};

export default function ProduccionPage() {
  const [recetas, setRecetas] = useState<RecetaOpt[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [recetaId, setRecetaId] = useState("");
  const [mode, setMode] = useState<"yield" | "line">("yield");
  const [baseLineId, setBaseLineId] = useState("");
  const [targetQuantity, setTargetQuantity] = useState("5");
  const [targetUnit, setTargetUnit] = useState("kg");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = recetas.find((r) => r.id === recetaId);
  const version =
    selected?.versions.find((v) => v.id === selected.currentVersionId) ||
    selected?.versions[0];

  const load = useCallback(async () => {
    const [rRes, pRes] = await Promise.all([
      fetch("/api/recetas"),
      fetch("/api/produccion"),
    ]);
    const rData = await rRes.json();
    const pData = await pRes.json();
    setRecetas(rData);
    setHistory(pData);
    if (!recetaId && rData[0]) {
      setRecetaId(rData[0].id);
      if (rData[0].yieldUnit) setTargetUnit(rData[0].yieldUnit);
    }
  }, [recetaId]);

  useEffect(() => {
    load().catch((e) => setError(String(e)));
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    if (selected.yieldUnit) setTargetUnit(selected.yieldUnit);
    const v =
      selected.versions.find((x) => x.id === selected.currentVersionId) ||
      selected.versions[0];
    const firstBase = v?.lines.find(
      (l) => l.canBeScaleBase && l.quantity != null && !l.isToTaste
    );
    if (firstBase) setBaseLineId(firstBase.id);
    setPreview(null);
  }, [selected]);

  async function onPreview(e?: FormEvent) {
    e?.preventDefault();
    if (!recetaId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/produccion/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recetaId,
          baseKind: mode,
          baseLineId: mode === "line" ? baseLineId : undefined,
          targetQuantity: Number(targetQuantity),
          targetUnit,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al calcular");
        setPreview(null);
        return;
      }
      setPreview(data.preview);
    } finally {
      setBusy(false);
    }
  }

  async function onConfirm(force = false) {
    if (!recetaId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/produccion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recetaId,
          baseKind: mode,
          baseLineId: mode === "line" ? baseLineId : undefined,
          targetQuantity: Number(targetQuantity),
          targetUnit,
          force,
        }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setPreview(data.preview);
        setError(
          "Inventario insuficiente. Revisá lo que falta comprar o confirmá igual (descuenta lo disponible)."
        );
        return;
      }
      if (!res.ok) {
        setError(data.error || "Error al confirmar");
        return;
      }
      setPreview(null);
      await load();
      alert("Producción registrada y stock descontado.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <h1 className="section-title">Producción</h1>
      <p className="section-sub">
        Partí de una ficha técnica: por rendimiento (ej. 5 kg de marinado) o por cantidad de un
        insumo (ej. 5 L de aceite). Al confirmar, se descuenta el inventario.
      </p>

      <section className="panel">
        <form onSubmit={onPreview}>
          <div className="form-grid">
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="prod-receta">Receta / ficha</label>
              <select
                id="prod-receta"
                value={recetaId}
                onChange={(e) => setRecetaId(e.target.value)}
                required
              >
                {recetas.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.yieldQty != null
                      ? ` (${r.yieldQty} ${r.yieldUnit} ${r.yieldLabel || ""})`
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Modo de escalado</label>
              <div className="seg-control">
                <button
                  type="button"
                  className={mode === "yield" ? "active" : ""}
                  onClick={() => setMode("yield")}
                  disabled={!selected?.yieldQty}
                >
                  Por rendimiento
                </button>
                <button
                  type="button"
                  className={mode === "line" ? "active" : ""}
                  onClick={() => setMode("line")}
                >
                  Por un insumo
                </button>
              </div>
            </div>

            {mode === "line" && version && (
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="prod-base">Ingrediente base</label>
                <select
                  id="prod-base"
                  value={baseLineId}
                  onChange={(e) => setBaseLineId(e.target.value)}
                >
                  {version.lines
                    .filter((l) => l.canBeScaleBase && !l.isToTaste && l.quantity != null)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.quantity} {l.unit})
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="field">
              <label htmlFor="prod-qty">Cantidad objetivo</label>
              <input
                id="prod-qty"
                type="number"
                step="any"
                min="0.001"
                required
                value={targetQuantity}
                onChange={(e) => setTargetQuantity(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="prod-unit">Unidad</label>
              <input
                id="prod-unit"
                value={targetUnit}
                onChange={(e) => setTargetUnit(e.target.value)}
                required
              />
            </div>
          </div>

          {error && <p className="error">{error}</p>}
          <div className="form-actions">
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Calculando…" : "Calcular necesidades"}
            </button>
          </div>
        </form>
      </section>

      {preview && (
        <section className="panel" style={{ marginTop: "1rem" }}>
          <h2 className="panel-title">
            Vista previa · factor ×{preview.scale.factor}
          </h2>
          <p className="section-sub" style={{ marginTop: 0 }}>
            Base: {preview.scale.baseName} → {preview.scale.targetQuantity} {targetUnit}
            {preview.scale.scaledYield &&
              ` · rendimiento ~ ${preview.scale.scaledYield.quantity} ${preview.scale.scaledYield.unit}`}
          </p>

          {preview.missing.length > 0 && (
            <div className="warn-box">
              <strong>Falta comprar:</strong>
              <ul>
                {preview.missing.map((m) => (
                  <li key={m.name}>
                    {m.name}: {m.missingQty} {m.unit}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <table className="data">
            <thead>
              <tr>
                <th>Ingrediente</th>
                <th>Necesario</th>
                <th>Stock</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {preview.lines.map((l) => (
                <tr key={l.lineId} className={!l.available ? "row-warn" : undefined}>
                  <td>{l.name}</td>
                  <td>
                    {l.quantity != null ? `${l.quantity} ${l.unit || ""}` : l.reason || "—"}
                  </td>
                  <td>
                    {l.onHand != null
                      ? `${l.onHand} ${l.onHandUnit}`
                      : l.reason || "—"}
                  </td>
                  <td>{l.available ? "OK" : "Falta"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="form-actions" style={{ marginTop: "1rem" }}>
            <button
              className="btn"
              type="button"
              disabled={busy || (!preview.canConfirm && preview.missing.length === 0)}
              onClick={() => onConfirm(false)}
            >
              Confirmar y descontar
            </button>
            {!preview.canConfirm && (
              <button
                className="btn ghost"
                type="button"
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      "Hay faltantes. Se descontará solo lo disponible. ¿Continuar?"
                    )
                  ) {
                    onConfirm(true);
                  }
                }}
              >
                Confirmar con faltantes
              </button>
            )}
          </div>
        </section>
      )}

      <section className="panel" style={{ marginTop: "1rem" }}>
        <h2 className="panel-title">Historial</h2>
        {history.length === 0 ? (
          <p className="empty">Todavía no hay producciones.</p>
        ) : (
          <ul className="inv-list">
            {history.map((h) => (
              <li key={h.id} className="inv-row">
                <div>
                  <strong>{h.title}</strong>
                  <div className="inv-meta">
                    {new Date(h.createdAt).toLocaleString("es")} · {h.receta.name} · ×
                    {h.factor}
                    {h.missingJson && <span className="inv-low-tag"> con faltantes</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
