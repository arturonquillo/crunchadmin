"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { FormSheet } from "@/components/FormSheet";
import {
  CATEGORIAS,
  ESTADOS,
  PRIORIDADES,
  type PendienteCategoria,
  type PendienteEstado,
  type Prioridad,
} from "@/lib/labels";
import {
  ZONE_IDS,
  type RestaurantZone,
} from "@/lib/zones";

type Pendiente = {
  id: string;
  title: string;
  description: string | null;
  categoria: PendienteCategoria;
  estado: PendienteEstado;
  prioridad: Prioridad;
  zone: RestaurantZone;
  dueDate: string | null;
};

type ViewMode = "lista" | "board";
type StatusFilter = "activos" | "hecho" | "todos";

const emptyForm = {
  title: "",
  description: "",
  categoria: "COMPRAS" as PendienteCategoria,
  estado: "PENDIENTE" as PendienteEstado,
  prioridad: "MEDIA" as Prioridad,
  zone: "oficina" as RestaurantZone,
};

function PriorityMark({
  prioridad,
  label,
  aria,
}: {
  prioridad: Prioridad;
  label: string;
  aria: string;
}) {
  if (prioridad === "BAJA") return null;
  const high = prioridad === "ALTA" || prioridad === "CRITICA";
  return (
    <span
      className={high ? "pendiente-prio high" : "pendiente-prio medium"}
      title={label}
      aria-label={aria}
    >
      {high ? "!!" : "!"}
    </span>
  );
}

function TagsIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.59 13.41 11 3.83V3H3v8l9.59 9.59a2 2 0 0 0 2.82 0l5.18-5.18a2 2 0 0 0 0-2.82Z" />
      <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export default function PendientesPage() {
  const t = useTranslations("Pendientes");
  const tLabels = useTranslations("Labels");
  const tCommon = useTranslations("Common");
  const [items, setItems] = useState<Pendiente[]>([]);
  const [filterCat, setFilterCat] = useState<string>("");
  const [filterZone, setFilterZone] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("activos");
  const [view, setView] = useState<ViewMode>("lista");
  const [showTags, setShowTags] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const zona = params.get("zona");
    if (zona && ZONE_IDS.includes(zona as RestaurantZone)) {
      setFilterZone(zona);
      setShowTags(true);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (filterCat) qs.set("categoria", filterCat);
    if (filterZone) qs.set("zona", filterZone);
    const res = await fetch(`/api/pendientes?${qs.toString()}`);
    const data = await res.json();
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [filterCat, filterZone]);

  useEffect(() => {
    load().catch((e) => setError(String(e)));
  }, [load]);

  const visibleItems = useMemo(() => {
    if (statusFilter === "hecho") {
      return items.filter((item) => item.estado === "HECHO");
    }
    if (statusFilter === "activos") {
      return items.filter((item) => item.estado !== "HECHO");
    }
    return items;
  }, [items, statusFilter]);

  const boardColumns = useMemo(() => {
    const byEstado: Record<PendienteEstado, Pendiente[]> = {
      PENDIENTE: [],
      EN_CURSO: [],
      HECHO: [],
    };
    for (const item of visibleItems) {
      byEstado[item.estado]?.push(item);
    }
    return byEstado;
  }, [visibleItems]);

  const tagsActive = Boolean(filterCat || filterZone);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/pendientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || t("createError"));
      return;
    }
    setForm(emptyForm);
    setShowForm(false);
    await load();
  }

  async function patch(id: string, patchBody: Partial<Pendiente>) {
    // Optimistic: drop from active list immediately when marked done
    if (patchBody.estado === "HECHO" && statusFilter === "activos") {
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, ...patchBody } : item
        )
      );
    }
    await fetch(`/api/pendientes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patchBody),
    });
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("confirmDelete"))) return;
    await fetch(`/api/pendientes/${id}`, { method: "DELETE" });
    await load();
  }

  function renderCard(item: Pendiente, compact = false) {
    return (
      <li
        key={item.id}
        className={compact ? "pendiente-board-card" : "list-card pendientes-card"}
      >
        <div className="list-card-main">
          <div className="pendiente-title-row">
            <PriorityMark
              prioridad={item.prioridad}
              label={tLabels(`prioridad.${item.prioridad}`)}
              aria={t("priorityOf", { label: tLabels(`prioridad.${item.prioridad}`) })}
            />
            <strong className="pendiente-title">{item.title}</strong>
          </div>
          {item.description && (
            <span className="list-card-note">{item.description}</span>
          )}
          {showTags && (
            <div className="list-card-badges">
              <span className="badge">{tLabels(`zone.${item.zone}`)}</span>
              <span className="badge">{tLabels(`categoria.${item.categoria}`)}</span>
            </div>
          )}
          <div className="pendientes-card-controls">
            {showTags && (
              <label>
                {t("fieldZone")}
                <select
                  value={item.zone}
                  onChange={(e) =>
                    patch(item.id, { zone: e.target.value as RestaurantZone })
                  }
                  aria-label={t("zoneOf", { title: item.title })}
                >
                  {ZONE_IDS.map((z) => (
                    <option key={z} value={z}>
                      {tLabels(`zone.${z}`)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className={showTags ? undefined : "pendiente-estado-only"}>
              {t("fieldEstado")}
              <select
                value={item.estado}
                onChange={(e) =>
                  patch(item.id, {
                    estado: e.target.value as PendienteEstado,
                  })
                }
                aria-label={t("estadoOf", { title: item.title })}
              >
                {ESTADOS.map((s) => (
                  <option key={s} value={s}>
                    {tLabels(`estado.${s}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <button
          type="button"
          className="btn danger icon-btn"
          onClick={() => remove(item.id)}
          aria-label={`${tCommon("delete")} ${item.title}`}
          title={tCommon("delete")}
        >
          <TrashIcon />
          <span className="icon-btn-label">{tCommon("delete")}</span>
        </button>
      </li>
    );
  }

  return (
    <div className="shell">
      <div className="page-head">
        <div>
          <h1 className="section-title">{t("title")}</h1>
          <p className="section-sub" style={{ marginBottom: 0 }}>
            {t("subtitle")}
          </p>
        </div>
        <div className="page-head-actions">
          <button type="button" className="btn" onClick={() => setShowForm(true)}>
            {t("new")}
          </button>
        </div>
      </div>

      <section className="panel" style={{ marginTop: "0.85rem" }}>
        <div className="pendientes-toolbar">
          <div className="seg-control pendientes-view-seg" role="tablist" aria-label={t("viewAria")}>
            <button
              type="button"
              className={view === "lista" ? "active" : undefined}
              onClick={() => setView("lista")}
              aria-pressed={view === "lista"}
            >
              {t("lista")}
            </button>
            <button
              type="button"
              className={view === "board" ? "active" : undefined}
              onClick={() => setView("board")}
              aria-pressed={view === "board"}
            >
              {t("board")}
            </button>
          </div>

          <div className="pendientes-toolbar-right">
            <select
              className="pendientes-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              aria-label={t("filterEstadoAria")}
            >
              <option value="activos">{t("activos")}</option>
              <option value="hecho">{t("hecho")}</option>
              <option value="todos">{t("todos")}</option>
            </select>

            <button
              type="button"
              className={
                showTags || tagsActive
                  ? "btn icon-btn tags-toggle active"
                  : "btn icon-btn tags-toggle"
              }
              onClick={() => setShowTags((v) => !v)}
              aria-pressed={showTags}
              aria-label={showTags ? t("hideTags") : t("showTags")}
              title={t("tags")}
            >
              <TagsIcon />
            </button>
          </div>
        </div>

        {showTags && (
          <div className="pendientes-tags-panel">
            <div className="tabs" role="tablist" aria-label={t("filterCategoriaAria")}>
              <button
                type="button"
                className={!filterCat ? "tab active" : "tab"}
                onClick={() => setFilterCat("")}
              >
                {t("allCategories")}
              </button>
              {CATEGORIAS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={filterCat === c ? "tab active" : "tab"}
                  onClick={() => setFilterCat(c)}
                >
                  {tLabels(`categoria.${c}`)}
                </button>
              ))}
            </div>
            <div className="tabs" role="tablist" aria-label={t("filterZonaAria")}>
              <button
                type="button"
                className={!filterZone ? "tab active" : "tab"}
                onClick={() => setFilterZone("")}
              >
                {t("allZones")}
              </button>
              {ZONE_IDS.map((z) => (
                <button
                  key={z}
                  type="button"
                  className={filterZone === z ? "tab active" : "tab"}
                  onClick={() => setFilterZone(z)}
                >
                  {tLabels(`zone.${z}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <p className="empty">{tCommon("loading")}</p>
        ) : visibleItems.length === 0 ? (
          <p className="empty">
            {t("empty")}{" "}
            <button type="button" className="btn ghost" onClick={() => setShowForm(true)}>
              {t("createOne")}
            </button>
          </p>
        ) : view === "lista" ? (
          <ul className="list-cards">{visibleItems.map((item) => renderCard(item))}</ul>
        ) : (
          <div
            className={
              statusFilter === "activos"
                ? "pendientes-board pendientes-board-active"
                : "pendientes-board"
            }
            role="list"
          >
            {(statusFilter === "activos"
              ? (["PENDIENTE", "EN_CURSO"] as PendienteEstado[])
              : statusFilter === "hecho"
                ? (["HECHO"] as PendienteEstado[])
                : ESTADOS
            ).map((estado) => (
              <section key={estado} className="pendientes-board-col" aria-label={tLabels(`estado.${estado}`)}>
                <header className="pendientes-board-col-head">
                  <h3>{tLabels(`estado.${estado}`)}</h3>
                  <span className="pendientes-board-count">
                    {boardColumns[estado].length}
                  </span>
                </header>
                <ul className="pendientes-board-list">
                  {boardColumns[estado].length === 0 ? (
                    <li className="pendientes-board-empty">{t("emptyBoard")}</li>
                  ) : (
                    boardColumns[estado].map((item) => renderCard(item, true))
                  )}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>

      <FormSheet
        open={showForm}
        title={t("newTitle")}
        kicker={t("kicker")}
        onClose={() => setShowForm(false)}
      >
        <form onSubmit={onCreate}>
          <div className="form-grid">
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="title">{t("fieldTitle")}</label>
              <input
                id="title"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                autoFocus
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="description">{t("fieldDescription")}</label>
              <textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="categoria">{t("fieldCategoria")}</label>
              <select
                id="categoria"
                value={form.categoria}
                onChange={(e) =>
                  setForm({
                    ...form,
                    categoria: e.target.value as PendienteCategoria,
                  })
                }
              >
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>
                    {tLabels(`categoria.${c}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="zone">{t("fieldZone")}</label>
              <select
                id="zone"
                value={form.zone}
                onChange={(e) =>
                  setForm({ ...form, zone: e.target.value as RestaurantZone })
                }
              >
                {ZONE_IDS.map((z) => (
                  <option key={z} value={z}>
                    {tLabels(`zone.${z}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="prioridad">{t("fieldPrioridad")}</label>
              <select
                id="prioridad"
                value={form.prioridad}
                onChange={(e) =>
                  setForm({ ...form, prioridad: e.target.value as Prioridad })
                }
              >
                {PRIORIDADES.map((p) => (
                  <option key={p} value={p}>
                    {tLabels(`prioridad.${p}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="estado">{t("fieldEstado")}</label>
              <select
                id="estado"
                value={form.estado}
                onChange={(e) =>
                  setForm({ ...form, estado: e.target.value as PendienteEstado })
                }
              >
                {ESTADOS.map((s) => (
                  <option key={s} value={s}>
                    {tLabels(`estado.${s}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error && <p className="error">{error}</p>}
          <div className="form-actions">
            <button className="btn" type="submit">
              Crear
            </button>
          </div>
        </form>
      </FormSheet>
    </div>
  );
}
