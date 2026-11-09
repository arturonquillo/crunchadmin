"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { FormSheet } from "@/components/FormSheet";
import {
  INSUMO_CATEGORIAS,
  type InsumoCategoria,
} from "@/lib/labels";
import {
  formatQty,
  packFillPercent,
  stockStatus,
  type StockStatus,
} from "@/lib/inventory";

type FichaLink = { id: string; name: string };

type Insumo = {
  id: string;
  name: string;
  baseUnit: string;
  category: string;
  quantityOnHand: number;
  packSize: number | null;
  minQty: number | null;
  reorderHint: string | null;
  purchaseNotes: string | null;
  fifoNote: string | null;
  fichas: FichaLink[];
};

const emptyForm = {
  name: "",
  baseUnit: "kg",
  category: "SECOS" as InsumoCategoria,
  quantityOnHand: "0",
  packSize: "",
  minQty: "",
  reorderHint: "",
  fifoNote: "",
};

function statusClass(s: StockStatus): string {
  if (s === "critical") return "crit";
  if (s === "reorder") return "warn";
  if (s === "ok") return "ok";
  return "unk";
}

export default function InventarioPage() {
  const t = useTranslations("Inventario");
  const tLabels = useTranslations("Labels");
  const tCommon = useTranslations("Common");
  const [items, setItems] = useState<Insumo[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState<string>("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [onlyAttention, setOnlyAttention] = useState(false);
  /** Categories open in the accordion; missing key = open (default expanded). */
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<"lista" | "grid">("grid");
  const [editItem, setEditItem] = useState<Insumo | null>(null);
  const [editForm, setEditForm] = useState({
    packSize: "",
    minQty: "",
    reorderHint: "",
  });
  const [editSaving, setEditSaving] = useState(false);

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (catFilter && item.category !== catFilter) return false;
      if (q && !item.name.toLowerCase().includes(q)) return false;
      if (onlyAttention) {
        const st = stockStatus({
          onHand: item.quantityOnHand,
          packSize: item.packSize,
          minQty: item.minQty,
        });
        if (st !== "reorder" && st !== "critical") return false;
      }
      return true;
    });
  }, [items, query, catFilter, onlyAttention]);

  const grouped = useMemo(() => {
    const map = new Map<string, Insumo[]>();
    for (const item of filtered) {
      const key = item.category || "OTROS";
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const sa = stockStatus({
          onHand: a.quantityOnHand,
          packSize: a.packSize,
          minQty: a.minQty,
        });
        const sb = stockStatus({
          onHand: b.quantityOnHand,
          packSize: b.packSize,
          minQty: b.minQty,
        });
        const rank = (s: StockStatus) =>
          s === "critical" ? 0 : s === "reorder" ? 1 : s === "unknown" ? 2 : 3;
        const d = rank(sa) - rank(sb);
        if (d !== 0) return d;
        return a.name.localeCompare(b.name, "es");
      });
    }
    return INSUMO_CATEGORIAS.filter((c) => map.has(c)).map((c) => ({
      category: c,
      label: tLabels(`insumoCategoria.${c}`),
      items: map.get(c)!,
    }));
  }, [filtered, tLabels]);

  const summary = useMemo(() => {
    let reorder = 0;
    let critical = 0;
    for (const item of items) {
      const st = stockStatus({
        onHand: item.quantityOnHand,
        packSize: item.packSize,
        minQty: item.minQty,
      });
      if (st === "critical") critical += 1;
      else if (st === "reorder") reorder += 1;
    }
    return {
      total: items.length,
      categories: new Set(items.map((i) => i.category)).size,
      reorder,
      critical,
    };
  }, [items]);

  const attentionByCat = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      const st = stockStatus({
        onHand: item.quantityOnHand,
        packSize: item.packSize,
        minQty: item.minQty,
      });
      if (st !== "reorder" && st !== "critical") continue;
      map.set(item.category, (map.get(item.category) || 0) + 1);
    }
    return map;
  }, [items]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setExpanded(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function isCatOpen(category: string): boolean {
    if (catFilter && catFilter === category) return true;
    return openCats[category] !== false;
  }

  function toggleCat(category: string) {
    if (catFilter && catFilter === category) return;
    setOpenCats((prev) => {
      const currentlyOpen = prev[category] !== false;
      return { ...prev, [category]: !currentlyOpen };
    });
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/inventario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        baseUnit: form.baseUnit,
        category: form.category,
        quantityOnHand: Number(form.quantityOnHand),
        packSize: form.packSize === "" ? null : Number(form.packSize),
        minQty: form.minQty === "" ? null : Number(form.minQty),
        reorderHint: form.reorderHint || null,
        fifoNote: form.fifoNote || null,
      }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Error al crear");
      return;
    }
    setForm(emptyForm);
    setShowForm(false);
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

  function openEditLimits(item: Insumo) {
    setEditItem(item);
    setEditForm({
      packSize: item.packSize != null ? String(item.packSize) : "",
      minQty: item.minQty != null ? String(item.minQty) : "",
      reorderHint: item.reorderHint || "",
    });
  }

  async function saveLimits(e: FormEvent) {
    e.preventDefault();
    if (!editItem) return;
    setEditSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/inventario/${editItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packSize: editForm.packSize === "" ? null : Number(editForm.packSize),
          minQty: editForm.minQty === "" ? null : Number(editForm.minQty),
          reorderHint: editForm.reorderHint || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Error al guardar");
        return;
      }
      setEditItem(null);
      await load();
    } finally {
      setEditSaving(false);
    }
  }

  async function receivePack(item: Insumo) {
    if (!item.packSize) {
      alert(t("definePackFirst"));
      return;
    }
    const next = Math.round((item.quantityOnHand + item.packSize) * 1000) / 1000;
    await adjust(item.id, next, t("receiveNote", { pack: item.packSize, unit: item.baseUnit }));
  }

  async function remove(id: string) {
    if (!confirm(t("confirmDelete"))) return;
    await fetch(`/api/inventario/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="shell inv-page">
      <header className="inv-hero">
        <div>
          <h1 className="section-title">{t("title")}</h1>
          <p className="section-sub" style={{ marginBottom: 0 }}>
            {t("subtitle")}
          </p>
        </div>
        <div className="inv-hero-actions">
          <Link href="/recetas" className="btn ghost">
            {t("fichasLink")}
          </Link>
          <button type="button" className="btn" onClick={() => setShowForm(true)}>
            {t("new")}
          </button>
        </div>
      </header>

      <p className="inv-fichas-hint">
        {t("fichasHintBefore")}
        <strong>{t("fichasHintStrong")}</strong>
        {t("fichasHintMid")}
        <Link href="/recetas">{t("fichasHintLink")}</Link>
        {t("fichasHintAfter")}
      </p>

      <section className="inv-summary" aria-label={t("summaryAria")}>
        <div className="inv-stat">
          <strong>{summary.total}</strong>
          <span>{t("statItems")}</span>
        </div>
        <div className="inv-stat">
          <strong>{summary.categories}</strong>
          <span>{t("statCategories")}</span>
        </div>
        <div className={`inv-stat ${summary.reorder ? "warn" : ""}`}>
          <strong>{summary.reorder}</strong>
          <span>{t("statReorder")}</span>
        </div>
        <div className={`inv-stat ${summary.critical ? "crit" : ""}`}>
          <strong>{summary.critical}</strong>
          <span>{t("statCritical")}</span>
        </div>
      </section>

      <section className="inv-toolbar panel">
        <div className="field" style={{ margin: 0, flex: 1 }}>
          <label htmlFor="inv-search">{t("search")}</label>
          <input
            id="inv-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
          />
        </div>
        <div className="inv-view-toggle" role="group" aria-label={t("viewAria")}>
          <button
            type="button"
            className={viewMode === "lista" ? "active" : ""}
            onClick={() => setViewMode("lista")}
          >
            {t("viewLista")}
          </button>
          <button
            type="button"
            className={viewMode === "grid" ? "active" : ""}
            onClick={() => setViewMode("grid")}
          >
            {t("viewGrid")}
          </button>
        </div>
        <label className="inv-check">
          <input
            type="checkbox"
            checked={onlyAttention}
            onChange={(e) => setOnlyAttention(e.target.checked)}
          />
          {t("onlyAttention")}
        </label>
      </section>

      <div className="inv-cats" role="tablist" aria-label={t("categoriesAria")}>
        <button
          type="button"
          className={!catFilter ? "active" : ""}
          onClick={() => setCatFilter("")}
        >
          {tCommon("all")}
        </button>
        {INSUMO_CATEGORIAS.map((c) => {
          const attn = attentionByCat.get(c) || 0;
          return (
            <button
              key={c}
              type="button"
              className={catFilter === c ? "active" : ""}
              onClick={() => setCatFilter(c)}
            >
              {tLabels(`insumoCategoria.${c}`)}
              {attn > 0 && <em className="inv-cat-attn">{attn}</em>}
            </button>
          );
        })}
      </div>

      <FormSheet
        open={Boolean(editItem)}
        title={editItem ? `${t("editLimitsTitle")} · ${editItem.name}` : t("editLimitsTitle")}
        kicker={t("kicker")}
        onClose={() => setEditItem(null)}
      >
        <form onSubmit={saveLimits}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="edit-pack">{t("fieldPack")}</label>
              <input
                id="edit-pack"
                type="number"
                step="any"
                min="0"
                value={editForm.packSize}
                onChange={(e) => setEditForm({ ...editForm, packSize: e.target.value })}
                placeholder={t("packPlaceholder")}
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="edit-min">{t("fieldMin")}</label>
              <input
                id="edit-min"
                type="number"
                step="any"
                min="0"
                value={editForm.minQty}
                onChange={(e) => setEditForm({ ...editForm, minQty: e.target.value })}
                placeholder={t("optionalPlaceholder")}
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="edit-hint">{t("fieldReorderHint")}</label>
              <input
                id="edit-hint"
                value={editForm.reorderHint}
                onChange={(e) =>
                  setEditForm({ ...editForm, reorderHint: e.target.value })
                }
                placeholder={t("reorderHintPlaceholder")}
              />
            </div>
          </div>
          {error && <p className="error">{error}</p>}
          <div className="form-actions">
            <button className="btn" type="submit" disabled={editSaving}>
              {t("saveLimits")}
            </button>
          </div>
        </form>
      </FormSheet>

      <FormSheet
        open={showForm}
        title={t("newTitle")}
        kicker={t("kicker")}
        onClose={() => setShowForm(false)}
      >
        <form onSubmit={onCreate}>
          <div className="form-grid">
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="inv-name">{t("fieldName")}</label>
              <input
                id="inv-name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t("namePlaceholder")}
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="inv-cat">{t("fieldCategory")}</label>
              <select
                id="inv-cat"
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value as InsumoCategoria })
                }
              >
                {INSUMO_CATEGORIAS.map((c) => (
                  <option key={c} value={c}>
                    {tLabels(`insumoCategoria.${c}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="inv-unit">{t("fieldUnit")}</label>
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
              <label htmlFor="inv-qty">{t("fieldQty")}</label>
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
              <label htmlFor="inv-pack">{t("fieldPack")}</label>
              <input
                id="inv-pack"
                type="number"
                step="any"
                min="0"
                value={form.packSize}
                onChange={(e) => setForm({ ...form, packSize: e.target.value })}
                placeholder={t("packPlaceholder")}
              />
            </div>
            <div className="field">
              <label htmlFor="inv-min">{t("fieldMin")}</label>
              <input
                id="inv-min"
                type="number"
                step="any"
                min="0"
                value={form.minQty}
                onChange={(e) => setForm({ ...form, minQty: e.target.value })}
                placeholder={t("optionalPlaceholder")}
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="inv-hint">{t("fieldReorderHint")}</label>
              <input
                id="inv-hint"
                value={form.reorderHint}
                onChange={(e) => setForm({ ...form, reorderHint: e.target.value })}
                placeholder={t("reorderHintPlaceholder")}
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="inv-fifo">{t("fieldFifo")}</label>
              <input
                id="inv-fifo"
                value={form.fifoNote}
                onChange={(e) => setForm({ ...form, fifoNote: e.target.value })}
                placeholder={t("fifoPlaceholder")}
              />
            </div>
          </div>
          {error && <p className="error">{error}</p>}
          <div className="form-actions">
            <button className="btn" type="submit">
              {t("addToCatalog")}
            </button>
          </div>
        </form>
      </FormSheet>

      <section className="inv-stock" style={{ marginTop: "1rem" }}>
        {loading ? (
          <p className="empty">{t("loading")}</p>
        ) : grouped.length === 0 ? (
          <p className="empty">{t("emptyFilter")}</p>
        ) : (
          grouped.map((group) => {
            const catOpen = isCatOpen(group.category);
            const panelId = `inv-cat-panel-${group.category}`;
            return (
            <div
              key={group.category}
              className={`inv-group ${catOpen ? "is-open" : "is-collapsed"}`}
            >
              <h2 className="inv-group-title">
                <button
                  type="button"
                  className="inv-acc-trigger"
                  aria-expanded={catOpen}
                  aria-controls={panelId}
                  onClick={() => toggleCat(group.category)}
                >
                  <span className="inv-acc-chevron" aria-hidden />
                  <span className="inv-acc-label">{group.label}</span>
                  <span className="inv-acc-count">{group.items.length}</span>
                </button>
              </h2>
              <ul
                id={panelId}
                className={`inv-cards ${viewMode === "grid" ? "is-grid" : "is-lista"}`}
                hidden={!catOpen}
                aria-hidden={!catOpen}
              >
                {group.items.map((item) => {
                  const fill = packFillPercent(item.quantityOnHand, item.packSize);
                  const st = stockStatus({
                    onHand: item.quantityOnHand,
                    packSize: item.packSize,
                    minQty: item.minQty,
                  });
                  const open = expanded === item.id;
                  const barWidth = fill == null ? 0 : Math.min(100, fill);
                  return (
                    <li
                      key={item.id}
                      className={`inv-card status-${statusClass(st)} ${open ? "is-expanded" : ""}`}
                    >
                      <button
                        type="button"
                        className="inv-card-main"
                        onClick={() => setExpanded(open ? null : item.id)}
                        aria-expanded={open}
                      >
                        <div className="inv-card-top">
                          <strong>{item.name}</strong>
                          <span className={`inv-badge ${statusClass(st)}`}>
                            {tLabels(`stockStatus.${st}`)}
                          </span>
                        </div>
                        <div className="inv-card-qty">
                          <span className="inv-qty-now">
                            {formatQty(item.quantityOnHand, item.baseUnit)}
                          </span>
                          {item.packSize != null && (
                            <span className="inv-qty-pack">
                              {t("ofPack", { pack: formatQty(item.packSize, item.baseUnit) })}
                              {fill != null && (
                                <span className="inv-pct"> · {fill}%</span>
                              )}
                            </span>
                          )}
                        </div>
                        {item.packSize != null ? (
                          <>
                            <div
                              className="inv-bar"
                              role="meter"
                              aria-valuenow={fill ?? 0}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label={t("stockLevelAria", { fill: fill ?? 0 })}
                            >
                              <div
                                className={`inv-bar-fill ${statusClass(st)}`}
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                            <p className="inv-bar-caption">
                              {t("packCaption", { pack: formatQty(item.packSize, item.baseUnit) })}
                            </p>
                          </>
                        ) : (
                          <p className="inv-no-pack">{t("noPack")}</p>
                        )}
                        {(st === "reorder" || st === "critical") && (
                          <p className="inv-reorder-msg">
                            {st === "critical"
                              ? t("urgentMsg")
                              : t("reorderMsg")}
                            {item.reorderHint ? ` ${item.reorderHint}` : ""}
                          </p>
                        )}
                      </button>

                      {open && (
                        <div className="inv-card-detail">
                          {item.minQty != null && (
                            <p>
                              <span className="muted">{t("reorderPoint")}</span>{" "}
                              {formatQty(item.minQty, item.baseUnit)}
                            </p>
                          )}
                          {item.fifoNote && (
                            <p>
                              <span className="muted">{t("fifo")}</span> {item.fifoNote}
                            </p>
                          )}
                          {item.purchaseNotes && (
                            <p>
                              <span className="muted">{t("purchase")}</span> {item.purchaseNotes}
                            </p>
                          )}
                          <div className="inv-fichas">
                            <span className="muted">{t("fichasLabel")}</span>{" "}
                            {item.fichas.length === 0 ? (
                              <span>
                                {t("noFichas")}
                                <Link href="/recetas">{t("seeFichas")}</Link>
                              </span>
                            ) : (
                              item.fichas.map((f, i) => (
                                <span key={f.id}>
                                  {i > 0 && ", "}
                                  <Link href={`/recetas/${f.id}`}>{f.name}</Link>
                                </span>
                              ))
                            )}
                          </div>
                          <div className="inv-actions">
                            <button
                              type="button"
                              className="btn ghost"
                              onClick={() => openEditLimits(item)}
                            >
                              {t("editLimits")}
                            </button>
                            <button
                              type="button"
                              className="btn ghost"
                              onClick={() => {
                                const v = prompt(
                                  t("qtyPrompt", { name: item.name, unit: item.baseUnit }),
                                  String(item.quantityOnHand)
                                );
                                if (v == null) return;
                                const n = Number(v.replace(",", "."));
                                if (!Number.isFinite(n)) return alert(tCommon("invalidNumber"));
                                adjust(item.id, n, t("adjustNote"));
                              }}
                            >
                              {t("adjustCount")}
                            </button>
                            <button
                              type="button"
                              className="btn ghost"
                              onClick={() => receivePack(item)}
                            >
                              {t("addPack")}
                            </button>
                            <button
                              type="button"
                              className="btn ghost danger"
                              onClick={() => remove(item.id)}
                            >
                              {t("remove")}
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
            );
          })
        )}
      </section>
    </div>
  );
}
