"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

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
  const t = useTranslations("Produccion");
  const tc = useTranslations("Common");
  const locale = useLocale();
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
        setError(data.error || t("calcError"));
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
        setError(t("insufficient"));
        return;
      }
      if (!res.ok) {
        setError(data.error || t("confirmError"));
        return;
      }
      setPreview(null);
      await load();
      alert(t("success"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <h1 className="section-title">{t("title")}</h1>
      <p className="section-sub">{t("subtitle")}</p>

      <section className="panel">
        <form onSubmit={onPreview}>
          <div className="form-grid">
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="prod-receta">{t("fieldReceta")}</label>
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
              <label>{t("scaleMode")}</label>
              <div className="seg-control">
                <button
                  type="button"
                  className={mode === "yield" ? "active" : ""}
                  onClick={() => setMode("yield")}
                  disabled={!selected?.yieldQty}
                >
                  {t("byYield")}
                </button>
                <button
                  type="button"
                  className={mode === "line" ? "active" : ""}
                  onClick={() => setMode("line")}
                >
                  {t("byLine")}
                </button>
              </div>
            </div>

            {mode === "line" && version && (
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="prod-base">{t("baseIngredient")}</label>
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
              <label htmlFor="prod-qty">{t("targetQty")}</label>
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
              <label htmlFor="prod-unit">{t("unit")}</label>
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
              {busy ? t("calculating") : t("calcNeeds")}
            </button>
          </div>
        </form>
      </section>

      {preview && (
        <section className="panel" style={{ marginTop: "1rem" }}>
          <h2 className="panel-title">
            {t("previewTitle", { factor: preview.scale.factor })}
          </h2>
          <p className="section-sub" style={{ marginTop: 0 }}>
            {t("previewBase", {
              base: preview.scale.baseName,
              qty: preview.scale.targetQuantity,
              unit: targetUnit,
            })}
            {preview.scale.scaledYield &&
              t("previewYield", {
                qty: preview.scale.scaledYield.quantity,
                unit: preview.scale.scaledYield.unit,
              })}
          </p>

          {preview.missing.length > 0 && (
            <div className="warn-box">
              <strong>{t("needBuy")}</strong>
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
                <th>{t("colIngredient")}</th>
                <th>{t("colNeed")}</th>
                <th>{t("colStock")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {preview.lines.map((l) => (
                <tr key={l.lineId} className={!l.available ? "row-warn" : undefined}>
                  <td>{l.name}</td>
                  <td>
                    {l.quantity != null
                      ? `${l.quantity} ${l.unit || ""}`
                      : l.reason || tc("dash")}
                  </td>
                  <td>
                    {l.onHand != null
                      ? `${l.onHand} ${l.onHandUnit}`
                      : l.reason || tc("dash")}
                  </td>
                  <td>{l.available ? t("ok") : t("missing")}</td>
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
              {t("confirmDeduct")}
            </button>
            {!preview.canConfirm && (
              <button
                className="btn ghost"
                type="button"
                disabled={busy}
                onClick={() => {
                  if (confirm(t("confirmShort"))) {
                    onConfirm(true);
                  }
                }}
              >
                {t("confirmWithMissing")}
              </button>
            )}
          </div>
        </section>
      )}

      <section className="panel" style={{ marginTop: "1rem" }}>
        <h2 className="panel-title">{t("history")}</h2>
        {history.length === 0 ? (
          <p className="empty">{t("empty")}</p>
        ) : (
          <ul className="inv-list">
            {history.map((h) => (
              <li key={h.id} className="inv-row">
                <div>
                  <strong>{h.title}</strong>
                  <div className="inv-meta">
                    {new Date(h.createdAt).toLocaleString(locale)} · {h.receta.name} · ×
                    {h.factor}
                    {h.missingJson && (
                      <span className="inv-low-tag">{t("withMissing")}</span>
                    )}
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
