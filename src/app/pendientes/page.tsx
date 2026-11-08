"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
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

const emptyForm = {
  title: "",
  description: "",
  categoria: "COMPRAS" as PendienteCategoria,
  estado: "PENDIENTE" as PendienteEstado,
  prioridad: "MEDIA" as Prioridad,
  zone: "oficina" as RestaurantZone,
};

export default function PendientesPage() {
  const [items, setItems] = useState<Pendiente[]>([]);
  const [filterCat, setFilterCat] = useState<string>("");
  const [filterZone, setFilterZone] = useState<string>("");
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const zona = params.get("zona");
    if (zona && ZONE_IDS.includes(zona as RestaurantZone)) {
      setFilterZone(zona);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (filterCat) qs.set("categoria", filterCat);
    if (filterZone) qs.set("zona", filterZone);
    const res = await fetch(`/api/pendientes?${qs.toString()}`);
    const data = await res.json();
    setItems(data);
    setLoading(false);
  }, [filterCat, filterZone]);

  useEffect(() => {
    load().catch((e) => setError(String(e)));
  }, [load]);

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

  return (
    <div className="shell">
      <div className="page-head">
        <div>
          <h1 className="section-title">Pendientes</h1>
          <p className="section-sub" style={{ marginBottom: 0 }}>
            Por categoría y zona. También anclados al mapa 3D.
          </p>
        </div>
        <div className="page-head-actions">
          <button type="button" className="btn" onClick={() => setShowForm(true)}>
            + Nuevo
          </button>
        </div>
      </div>

      <section className="panel" style={{ marginTop: "0.85rem" }}>
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

        {loading ? (
          <p className="empty">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="empty">
            No hay pendientes.{" "}
            <button type="button" className="btn ghost" onClick={() => setShowForm(true)}>
              Crear uno
            </button>
          </p>
        ) : (
          <ul className="list-cards">
            {items.map((item) => (
              <li key={item.id} className="list-card pendientes-card">
                <div className="list-card-main">
                  <strong>{item.title}</strong>
                  {item.description && (
                    <span className="list-card-note">{item.description}</span>
                  )}
                  <div className="list-card-badges">
                    <span className="badge">{ZONE_LABEL[item.zone]}</span>
                    <span className="badge">{CATEGORIA_LABEL[item.categoria]}</span>
                    <span
                      className={
                        item.prioridad === "CRITICA" || item.prioridad === "ALTA"
                          ? "badge danger"
                          : "badge"
                      }
                    >
                      {PRIORIDAD_LABEL[item.prioridad]}
                    </span>
                  </div>
                  <div className="pendientes-card-controls">
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
                    <label>
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
                  className="btn danger"
                  style={{ padding: "0.4rem 0.65rem", fontSize: "0.8rem" }}
                  onClick={() => remove(item.id)}
                >
                  Borrar
                </button>
              </li>
            ))}
          </ul>
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
