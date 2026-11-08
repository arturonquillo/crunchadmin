"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

type Line = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  isToTaste: boolean;
  canBeScaleBase: boolean;
};

type Version = {
  id: string;
  number: number;
  label: string | null;
  changelog: string | null;
  createdAt: string;
  lines: Line[];
};

type Receta = {
  id: string;
  name: string;
  notes: string | null;
  yieldQty: number | null;
  yieldUnit: string | null;
  yieldLabel: string | null;
  currentVersionId: string | null;
  versions: Version[];
};

type ScaleResult = {
  factor: number;
  baseName: string;
  lines: {
    id: string;
    name: string;
    originalQuantity: number | null;
    scaledQuantity: number | null;
    unit: string | null;
    scaled: boolean;
    reason?: string;
  }[];
  scaledYield: { quantity: number; unit: string; label: string | null } | null;
};

export default function RecetaDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const t = useTranslations("RecetaDetail");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const [receta, setReceta] = useState<Receta | null>(null);
  const [versionId, setVersionId] = useState<string>("");
  const [baseKind, setBaseKind] = useState<"yield" | "line">("yield");
  const [baseLineId, setBaseLineId] = useState("");
  const [targetQty, setTargetQty] = useState("1.8");
  const [targetUnit, setTargetUnit] = useState("kg");
  const [result, setResult] = useState<ScaleResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changelog, setChangelog] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/recetas/${id}`);
    if (!res.ok) {
      setError(t("notFound"));
      return;
    }
    const data: Receta = await res.json();
    setReceta(data);
    const current =
      data.versions.find((v) => v.id === data.currentVersionId) ||
      data.versions[0];
    if (current) {
      setVersionId(current.id);
      const firstScalable = current.lines.find(
        (l) => !l.isToTaste && l.quantity != null
      );
      if (firstScalable) setBaseLineId(firstScalable.id);
    }
    if (data.yieldUnit) setTargetUnit(data.yieldUnit);
  }, [id, t]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const version = useMemo(
    () => receta?.versions.find((v) => v.id === versionId),
    [receta, versionId]
  );

  async function onScale(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    const res = await fetch(`/api/recetas/${id}/scale`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        versionId,
        baseKind,
        baseLineId: baseKind === "line" ? baseLineId : undefined,
        targetQuantity: Number(targetQty),
        targetUnit,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || t("scaleError"));
      return;
    }
    setResult(data);
  }

  async function saveScaledAsVersion() {
    if (!result || !version) return;
    const lines = result.lines.map((l) => ({
      name: l.name,
      quantity: l.scaledQuantity,
      unit: l.unit,
      isToTaste: !l.scaled,
    }));
    const res = await fetch(`/api/recetas/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: t("scaledLabel", { factor: result.factor }),
        changelog:
          changelog ||
          t("scaledChangelog", { base: result.baseName, factor: result.factor }),
        lines,
        yieldQty: result.scaledYield?.quantity,
        yieldUnit: result.scaledYield?.unit,
        yieldLabel: result.scaledYield?.label,
        publish: true,
      }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || t("saveError"));
      return;
    }
    setChangelog("");
    await load();
  }

  if (!receta) {
    return <p className="empty">{error || tc("loading")}</p>;
  }

  return (
    <div className="shell">
      <p style={{ marginBottom: "0.5rem" }}>
        <Link href="/recetas" style={{ color: "var(--accent-deep)" }}>
          {t("back")}
        </Link>
      </p>
      <h1 className="section-title">{receta.name}</h1>
      <p className="section-sub">
        {receta.notes || t("techSheet")}
        {receta.yieldQty != null &&
          ` · ${t("yield")}: ${receta.yieldQty} ${receta.yieldUnit} ${receta.yieldLabel ? `(${receta.yieldLabel})` : ""}`}
      </p>

      <section className="panel">
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>{t("versions")}</h2>
        <div className="field" style={{ maxWidth: 360, marginBottom: "1rem" }}>
          <label htmlFor="ver">{t("activeVersion")}</label>
          <select
            id="ver"
            value={versionId}
            onChange={(e) => setVersionId(e.target.value)}
          >
            {receta.versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.number}
                {v.label ? ` — ${v.label}` : ""}
                {v.id === receta.currentVersionId ? ` ${t("published")}` : ""}
              </option>
            ))}
          </select>
        </div>
        {version && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t("colIngredient")}</th>
                  <th>{t("colQty")}</th>
                  <th>{t("colNotes")}</th>
                </tr>
              </thead>
              <tbody>
                {version.lines.map((l) => (
                  <tr key={l.id}>
                    <td>{l.name}</td>
                    <td>
                      {l.isToTaste
                        ? t("toTaste")
                        : `${l.quantity ?? tc("dash")} ${l.unit ?? ""}`}
                    </td>
                    <td>
                      {l.canBeScaleBase ? (
                        <span className="badge">{t("canBeBase")}</span>
                      ) : (
                        tc("dash")
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>
          {t("scaleTitle")}
        </h2>
        <p className="section-sub" style={{ marginBottom: "1rem" }}>
          {t("scaleHelp")}
        </p>
        <form onSubmit={onScale}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="bk">{t("base")}</label>
              <select
                id="bk"
                value={baseKind}
                onChange={(e) =>
                  setBaseKind(e.target.value as "yield" | "line")
                }
              >
                <option value="yield">
                  {t("baseYield")}
                  {receta.yieldLabel ? ` (${receta.yieldLabel})` : ""}
                </option>
                <option value="line">{t("baseLine")}</option>
              </select>
            </div>
            {baseKind === "line" && version && (
              <div className="field">
                <label htmlFor="bl">{t("baseIngredient")}</label>
                <select
                  id="bl"
                  value={baseLineId}
                  onChange={(e) => setBaseLineId(e.target.value)}
                >
                  {version.lines
                    .filter((l) => !l.isToTaste && l.quantity != null)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.quantity} {l.unit})
                      </option>
                    ))}
                </select>
              </div>
            )}
            <div className="field">
              <label htmlFor="tq">{t("targetQty")}</label>
              <input
                id="tq"
                type="number"
                step="any"
                required
                value={targetQty}
                onChange={(e) => setTargetQty(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="tu">{t("unit")}</label>
              <input
                id="tu"
                value={targetUnit}
                onChange={(e) => setTargetUnit(e.target.value)}
              />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn" type="submit">
              {t("calculate")}
            </button>
          </div>
        </form>

        {error && (
          <p style={{ color: "var(--danger)", marginTop: "0.75rem" }}>{error}</p>
        )}

        {result && (
          <div className="scale-result">
            <p style={{ marginTop: 0 }}>
              {t("factor")} <strong>×{result.factor}</strong> · {t("baseLabel")}: {result.baseName}
              {result.scaledYield &&
                ` · ${t("newYield")}: ${result.scaledYield.quantity} ${result.scaledYield.unit}`}
            </p>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t("colIngredient")}</th>
                    <th>{t("colOriginal")}</th>
                    <th>{t("colScaled")}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.lines.map((l) => (
                    <tr key={l.id}>
                      <td>{l.name}</td>
                      <td>
                        {l.originalQuantity != null
                          ? `${l.originalQuantity} ${l.unit ?? ""}`
                          : tc("dash")}
                      </td>
                      <td>
                        {l.scaled
                          ? `${l.scaledQuantity} ${l.unit ?? ""}`
                          : l.reason || tc("dash")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="field" style={{ marginTop: "0.75rem" }}>
              <label htmlFor="cl">{t("changelog")}</label>
              <input
                id="cl"
                value={changelog}
                onChange={(e) => setChangelog(e.target.value)}
                placeholder={t("changelogPlaceholder")}
              />
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={saveScaledAsVersion}
              >
                {t("saveVersion")}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>{t("history")}</h2>
        <div className="version-list">
          {receta.versions.map((v) => (
            <div key={v.id} className="version-item">
              <strong>
                v{v.number}
                {v.label ? ` — ${v.label}` : ""}
              </strong>
              <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                {new Date(v.createdAt).toLocaleString(locale)}
                {v.changelog ? ` · ${v.changelog}` : ""}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
