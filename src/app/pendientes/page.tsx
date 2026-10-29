"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
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

type Pendiente = {
  id: string;
  title: string;
  description: string | null;
  categoria: PendienteCategoria;
  estado: PendienteEstado;
  prioridad: Prioridad;
  dueDate: string | null;
};

const emptyForm = {
  title: "",
  description: "",
  categoria: "COMPRAS" as PendienteCategoria,
  estado: "PENDIENTE" as PendienteEstado,
  prioridad: "MEDIA" as Prioridad,
};

export default function PendientesPage() {
  const [items, setItems] = useState<Pendiente[]>([]);
  const [filterCat, setFilterCat] = useState<string>("");
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = filterCat ? `?categoria=${filterCat}` : "";
    const res = await fetch(`/api/pendientes${qs}`);
    const data = await res.json();
    setItems(data);
    setLoading(false);
  }, [filterCat]);

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
    <>
      <h1 className="section-title">Pendientes</h1>
      <p className="section-sub">
        Lista unificada por categoría: mejoras, compras, planes, insumos y nuevas
        recetas.
      </p>

      <section className="panel">
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Nuevo pendiente</h2>
        <form onSubmit={onCreate}>
          <div className="form-grid">
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="title">Título</label>
              <input
                id="title"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="description">Descripción</label>
              <textarea
                id="description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
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
          <div className="form-actions">
            <button className="btn" type="submit">
              Crear
            </button>
          </div>
        </form>
        {error && (
          <p style={{ color: "var(--danger)", marginTop: "0.75rem" }}>{error}</p>
        )}
      </section>

      <section className="panel">
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

        {loading ? (
          <p className="empty">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="empty">No hay pendientes en este filtro.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Categoría</th>
                  <th>Prioridad</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.title}</strong>
                      {item.description && (
                        <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                          {item.description}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge">
                        {CATEGORIA_LABEL[item.categoria]}
                      </span>
                    </td>
                    <td>
                      <span
                        className={
                          item.prioridad === "CRITICA" || item.prioridad === "ALTA"
                            ? "badge danger"
                            : "badge"
                        }
                      >
                        {PRIORIDAD_LABEL[item.prioridad]}
                      </span>
                    </td>
                    <td>
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
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn danger"
                        style={{ padding: "0.35rem 0.6rem", fontSize: "0.8rem" }}
                        onClick={() => remove(item.id)}
                      >
                        Borrar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
