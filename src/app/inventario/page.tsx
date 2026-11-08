"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { isLowStock } from "@/lib/inventory";

type Insumo = {
  id: string;
  name: string;
  baseUnit: string;
  quantityOnHand: number;
  minQty: number | null;
  reorderHint: string | null;
  purchaseNotes: string | null;
};

const emptyForm = {
  name: "",
  baseUnit: "kg",
  quantityOnHand: "0",
  minQty: "",
  reorderHint: "",
};

export default function InventarioPage() {
  const [items, setItems] = useState<Insumo[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/inventario");
    const data = await res.json();
    setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch((e) => setError(String(e)));
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/inventario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        baseUnit: form.baseUnit,
        quantityOnHand: Number(form.quantityOnHand),
        minQty: form.minQty === "" ? null : Number(form.minQty),
        reorderHint: form.reorderHint || null,
      }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Error al crear");
      return;
    }
    setForm(emptyForm);
    await load();
  }

  async function adjust(id: string, nextQty: number, note?: string) {
    await fetch(`/api/inventario/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantityOnHand: nextQty, note }),
    });
    await load();
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este insumo del catálogo?")) return;
    await fetch(`/api/inventario/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="shell">
      <h1 className="section-title">Inventario</h1>
      <p className="section-sub">
        Catálogo de insumos con stock. Se actualiza al informar por el botón Hablar / chat y al
        confirmar una producción.
      </p>

      <section className="panel">
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Nuevo insumo</h2>
        <form onSubmit={onCreate}>
          <div className="form-grid">
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="inv-name">Nombre</label>
              <input
                id="inv-name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej. Aceite vegetal"
              />
            </div>
            <div className="field">
              <label htmlFor="inv-unit">Unidad</label>
              <select
                id="inv-unit"
                value={form.baseUnit}
                onChange={(e) => setForm({ ...form, baseUnit: e.target.value })}
              >
                {["kg", "g", "L", "ml", "ud"].map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="inv-qty">Stock actual</label>
              <input
                id="inv-qty"
                type="number"
                step="any"
                min="0"
                value={form.quantityOnHand}
                onChange={(e) => setForm({ ...form, quantityOnHand: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="inv-min">Mínimo (reorden)</label>
              <input
                id="inv-min"
                type="number"
                step="any"
                min="0"
                value={form.minQty}
                onChange={(e) => setForm({ ...form, minQty: e.target.value })}
                placeholder="Opcional"
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="inv-hint">Hint de reorden</label>
              <input
                id="inv-hint"
                value={form.reorderHint}
                onChange={(e) => setForm({ ...form, reorderHint: e.target.value })}
                placeholder="Ej. Bidón 20 L"
              />
            </div>
          </div>
          {error && <p className="error">{error}</p>}
          <div className="form-actions">
            <button className="btn" type="submit">
              Agregar
            </button>
          </div>
        </form>
      </section>

      <section className="panel" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Stock</h2>
        {loading ? (
          <p className="empty">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="empty">Sin insumos todavía.</p>
        ) : (
          <ul className="inv-list">
            {items.map((item) => {
              const low = isLowStock(item.quantityOnHand, item.minQty);
              return (
                <li key={item.id} className={`inv-row ${low ? "low" : ""}`}>
                  <div>
                    <strong>{item.name}</strong>
                    <div className="inv-meta">
                      {item.quantityOnHand} {item.baseUnit}
                      {item.minQty != null && (
                        <span> · mín. {item.minQty}</span>
                      )}
                      {low && <span className="inv-low-tag"> Bajo</span>}
                    </div>
                    {(item.reorderHint || item.purchaseNotes) && (
                      <div className="inv-hint">
                        {item.reorderHint || item.purchaseNotes}
                      </div>
                    )}
                  </div>
                  <div className="inv-actions">
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => {
                        const v = prompt(
                          `Nuevo stock de ${item.name} (${item.baseUnit})`,
                          String(item.quantityOnHand)
                        );
                        if (v == null) return;
                        const n = Number(v.replace(",", "."));
                        if (!Number.isFinite(n)) return alert("Número inválido");
                        adjust(item.id, n, "Ajuste manual");
                      }}
                    >
                      Ajustar
                    </button>
                    <button
                      type="button"
                      className="btn ghost danger"
                      onClick={() => remove(item.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
