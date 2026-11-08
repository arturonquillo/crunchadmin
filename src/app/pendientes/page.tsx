"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { FormSheet } from "@/components/FormSheet";
import {
  CATEGORIA_LABEL,
  CATEGORIAS,
  ESTADO_LABEL,
  ESTADOS,
  PRIORIDAD_LABEL,
  PRIORIDADES,
  type PendienteCategoria,
  type PendienteEstado,
  type Prioridad,
} from "@/lib/labels";
import {
  ZONE_IDS,
  ZONE_LABEL,
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

function PriorityMark({ prioridad }: { prioridad: Prioridad }) {
  if (prioridad === "BAJA") return null;
  const high = prioridad === "ALTA" || prioridad === "CRITICA";
  return (
    <span
      className={high ? "pendiente-prio high" : "pendiente-prio medium"}
      title={PRIORIDAD_LABEL[prioridad]}
      aria-label={`Prioridad ${PRIORIDAD_LABEL[prioridad]}`}
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
      setError(d.error || "Error al crear");
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
    if (!confirm("¿Eliminar este pendiente?")) return;
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
            <PriorityMark prioridad={item.prioridad} />
            <strong className="pendiente-title">{item.title}</strong>
          </div>
          {item.description && (
            <span className="list-card-note">{item.description}</span>
          )}
          {showTags && (
            <div className="list-card-badges">
              <span className="badge">{ZONE_LABEL[item.zone]}</span>
              <span className="badge">{CATEGORIA_LABEL[item.categoria]}</span>
            </div>
          )}
          <div className="pendientes-card-controls">
            {showTags && (
              <label>
                Zona
                <select
                  value={item.zone}
                  onChange={(e) =>
                    patch(item.id, { zone: e.target.value as RestaurantZone })
                  }
                  aria-label={`Zona de ${item.title}`}
                >
                  {ZONE_IDS.map((z) => (
                    <option key={z} value={z}>
                      {ZONE_LABEL[z]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className={showTags ? undefined : "pendiente-estado-only"}>
              Estado
              <select
                value={item.estado}
                onChange={(e) =>
                  patch(item.id, {
                    estado: e.target.value as PendienteEstado,
                  })
                }
                aria-label={`Estado de ${item.title}`}
              >
                {ESTADOS.map((s) => (
                  <option key={s} value={s}>
                    {ESTADO_LABEL[s]}
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
          aria-label={`Borrar ${item.title}`}
          title="Borrar"
        >
          <TrashIcon />
          <span className="icon-btn-label">Borrar</span>
        </button>
      </li>
    );
  }

  return (
    <div className="shell">
      <div className="page-head">
        <div>
          <h1 className="section-title">Pendientes</h1>
          <p className="section-sub" style={{ marginBottom: 0 }}>
            Lista y tablero. Hechos fuera de activos.
          </p>
        </div>
        <div className="page-head-actions">
          <button type="button" className="btn" onClick={() => setShowForm(true)}>
            + Nuevo
          </button>
        </div>
      </div>

      <section className="panel" style={{ marginTop: "0.85rem" }}>
        <div className="pendientes-toolbar">
          <div className="seg-control pendientes-view-seg" role="tablist" aria-label="Vista">
            <button
              type="button"
              className={view === "lista" ? "active" : undefined}
              onClick={() => setView("lista")}
              aria-pressed={view === "lista"}
            >
              Lista
            </button>
            <button
              type="button"
              className={view === "board" ? "active" : undefined}
              onClick={() => setView("board")}
              aria-pressed={view === "board"}
            >
              Board
            </button>
          </div>

          <div className="pendientes-toolbar-right">
            <select
              className="pendientes-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              aria-label="Filtrar por estado"
            >
              <option value="activos">Activos</option>
              <option value="hecho">Hechos</option>
              <option value="todos">Todos</option>
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
              aria-label={showTags ? "Ocultar etiquetas" : "Mostrar etiquetas"}
              title="Etiquetas"
            >
              <TagsIcon />
            </button>
          </div>
        </div>

        {showTags && (
          <div className="pendientes-tags-panel">
            <div className="tabs" role="tablist" aria-label="Filtrar categoría">
              <button
                type="button"
                className={!filterCat ? "tab active" : "tab"}
                onClick={() => setFilterCat("")}
              >
                Todas
              </button>
              {CATEGORIAS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={filterCat === c ? "tab active" : "tab"}
                  onClick={() => setFilterCat(c)}
                >
                  {CATEGORIA_LABEL[c]}
                </button>
              ))}
            </div>
            <div className="tabs" role="tablist" aria-label="Filtrar zona">
              <button
                type="button"
                className={!filterZone ? "tab active" : "tab"}
                onClick={() => setFilterZone("")}
              >
                Todas las zonas
              </button>
              {ZONE_IDS.map((z) => (
                <button
                  key={z}
                  type="button"
                  className={filterZone === z ? "tab active" : "tab"}
                  onClick={() => setFilterZone(z)}
                >
                  {ZONE_LABEL[z]}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <p className="empty">Cargando…</p>
        ) : visibleItems.length === 0 ? (
          <p className="empty">
            No hay pendientes en este filtro.{" "}
            <button type="button" className="btn ghost" onClick={() => setShowForm(true)}>
              Crear uno
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
              <section key={estado} className="pendientes-board-col" aria-label={ESTADO_LABEL[estado]}>
                <header className="pendientes-board-col-head">
                  <h3>{ESTADO_LABEL[estado]}</h3>
                  <span className="pendientes-board-count">
                    {boardColumns[estado].length}
                  </span>
                </header>
                <ul className="pendientes-board-list">
                  {boardColumns[estado].length === 0 ? (
                    <li className="pendientes-board-empty">Vacío</li>
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
        title="Nuevo pendiente"
        kicker="Tareas"
        onClose={() => setShowForm(false)}
      >
        <form onSubmit={onCreate}>
          <div className="form-grid">
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="title">Título</label>
              <input
                id="title"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                autoFocus
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="description">Descripción</label>
              <textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="categoria">Categoría</label>
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
                    {CATEGORIA_LABEL[c]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="zone">Zona</label>
              <select
                id="zone"
                value={form.zone}
                onChange={(e) =>
                  setForm({ ...form, zone: e.target.value as RestaurantZone })
                }
              >
                {ZONE_IDS.map((z) => (
                  <option key={z} value={z}>
                    {ZONE_LABEL[z]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="prioridad">Prioridad</label>
              <select
                id="prioridad"
                value={form.prioridad}
                onChange={(e) =>
                  setForm({ ...form, prioridad: e.target.value as Prioridad })
                }
              >
                {PRIORIDADES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORIDAD_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="estado">Estado</label>
              <select
                id="estado"
                value={form.estado}
                onChange={(e) =>
                  setForm({ ...form, estado: e.target.value as PendienteEstado })
                }
              >
                {ESTADOS.map((s) => (
                  <option key={s} value={s}>
                    {ESTADO_LABEL[s]}
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
