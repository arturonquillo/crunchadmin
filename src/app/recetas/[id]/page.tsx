"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

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
      setError("Receta no encontrada");
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
  }, [id]);

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
      setError(data.error || "Error de escalado");
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
        label: `Escalado ×${result.factor}`,
        changelog:
          changelog ||
          `Batch escalado desde ${result.baseName} (factor ${result.factor})`,
        lines,
        yieldQty: result.scaledYield?.quantity,
        yieldUnit: result.scaledYield?.unit,
        yieldLabel: result.scaledYield?.label,
        publish: true,
      }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "No se pudo guardar versión");
      return;
    }
    setChangelog("");
    await load();
  }

  if (!receta) {
    return <p className="empty">{error || "Cargando…"}</p>;
  }

  return (
    <div className="shell">
      <p style={{ marginBottom: "0.5rem" }}>
        <Link href="/recetas" style={{ color: "var(--accent-deep)" }}>
          ← Recetas
        </Link>
      </p>
      <h1 className="section-title">{receta.name}</h1>
      <p className="section-sub">
        {receta.notes || "Ficha técnica"}
        {receta.yieldQty != null &&
          ` · Rendimiento: ${receta.yieldQty} ${receta.yieldUnit} ${receta.yieldLabel ? `(${receta.yieldLabel})` : ""}`}
      </p>

      <section className="panel">
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Versiones</h2>
        <div className="field" style={{ maxWidth: 360, marginBottom: "1rem" }}>
          <label htmlFor="ver">Versión activa de consulta</label>
          <select
            id="ver"
            value={versionId}
            onChange={(e) => setVersionId(e.target.value)}
          >
            {receta.versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.number}
                {v.label ? ` — ${v.label}` : ""}
                {v.id === receta.currentVersionId ? " (publicada)" : ""}
              </option>
            ))}
          </select>
        </div>
        {version && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Ingrediente</th>
                  <th>Cantidad</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {version.lines.map((l) => (
                  <tr key={l.id}>
                    <td>{l.name}</td>
                    <td>
                      {l.isToTaste
                        ? "A gusto"
                        : `${l.quantity ?? "—"} ${l.unit ?? ""}`}
                    </td>
                    <td>
                      {l.canBeScaleBase ? (
                        <span className="badge">Puede ser base</span>
                      ) : (
                        "—"
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
          Calculadora de escalado
        </h2>
        <p className="section-sub" style={{ marginBottom: "1rem" }}>
          Elige cualquier ingrediente (o el rendimiento) como base e indica la
          cantidad objetivo. Ejemplo demo: 1 kg mayonesa → 1,8 kg.
        </p>
        <form onSubmit={onScale}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="bk">Base</label>
              <select
                id="bk"
                value={baseKind}
                onChange={(e) =>
                  setBaseKind(e.target.value as "yield" | "line")
                }
              >
                <option value="yield">
                  Rendimiento
                  {receta.yieldLabel ? ` (${receta.yieldLabel})` : ""}
                </option>
                <option value="line">Ingrediente de la ficha</option>
              </select>
            </div>
            {baseKind === "line" && version && (
              <div className="field">
                <label htmlFor="bl">Ingrediente base</label>
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
              <label htmlFor="tq">Cantidad objetivo</label>
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
              <label htmlFor="tu">Unidad</label>
              <input
                id="tu"
                value={targetUnit}
                onChange={(e) => setTargetUnit(e.target.value)}
              />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn" type="submit">
              Calcular
            </button>
          </div>
        </form>

        {error && (
          <p style={{ color: "var(--danger)", marginTop: "0.75rem" }}>{error}</p>
        )}

        {result && (
          <div className="scale-result">
            <p style={{ marginTop: 0 }}>
              Factor <strong>×{result.factor}</strong> · base: {result.baseName}
              {result.scaledYield &&
                ` · nuevo rendimiento: ${result.scaledYield.quantity} ${result.scaledYield.unit}`}
            </p>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Ingrediente</th>
                    <th>Original</th>
                    <th>Escalado</th>
                  </tr>
                </thead>
                <tbody>
                  {result.lines.map((l) => (
                    <tr key={l.id}>
                      <td>{l.name}</td>
                      <td>
                        {l.originalQuantity != null
                          ? `${l.originalQuantity} ${l.unit ?? ""}`
                          : "—"}
                      </td>
                      <td>
                        {l.scaled
                          ? `${l.scaledQuantity} ${l.unit ?? ""}`
                          : l.reason || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="field" style={{ marginTop: "0.75rem" }}>
              <label htmlFor="cl">Changelog (opcional)</label>
              <input
                id="cl"
                value={changelog}
                onChange={(e) => setChangelog(e.target.value)}
                placeholder="Guardar como nueva versión de producción"
              />
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={saveScaledAsVersion}
              >
                Guardar como nueva versión
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Historial</h2>
        <div className="version-list">
          {receta.versions.map((v) => (
            <div key={v.id} className="version-item">
              <strong>
                v{v.number}
                {v.label ? ` — ${v.label}` : ""}
              </strong>
              <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                {new Date(v.createdAt).toLocaleString("es")}
                {v.changelog ? ` · ${v.changelog}` : ""}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
