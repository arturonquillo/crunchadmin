"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CATEGORIAS,
  ESTADOS,
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
  const t = useTranslations("Pendientes");
  const tc = useTranslations("Common");
  const tl = useTranslations("Labels");
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
      setError(d.error || t("createError"));
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
    if (!confirm(t("confirmDelete"))) return;
    await fetch(`/api/pendientes/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <>
      <h1 className="section-title">{t("title")}</h1>
      <p className="section-sub">{t("subtitle")}</p>

      <section className="panel">
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>{t("newTitle")}</h2>
        <form onSubmit={onCreate}>
          <div className="form-grid">
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="title">{t("fieldTitle")}</label>
              <input
                id="title"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="description">{t("fieldDescription")}</label>
              <textarea
                id="description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
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
                    {tl(`categoria.${c}`)}
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
                    {tl(`prioridad.${p}`)}
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
                  setForm({
                    ...form,
                    estado: e.target.value as PendienteEstado,
                  })
                }
              >
                {ESTADOS.map((s) => (
                  <option key={s} value={s}>
                    {tl(`estado.${s}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button className="btn" type="submit">
              {tc("create")}
            </button>
          </div>
        </form>
        {error && (
          <p style={{ color: "var(--danger)", marginTop: "0.75rem" }}>{error}</p>
        )}
      </section>

      <section className="panel">
        <div className="tabs" role="tablist" aria-label={t("filterAria")}>
          <button
            type="button"
            className={!filterCat ? "tab active" : "tab"}
            onClick={() => setFilterCat("")}
          >
            {tc("all")}
          </button>
          {CATEGORIAS.map((c) => (
            <button
              key={c}
              type="button"
              className={filterCat === c ? "tab active" : "tab"}
              onClick={() => setFilterCat(c)}
            >
              {tl(`categoria.${c}`)}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="empty">{tc("loading")}</p>
        ) : items.length === 0 ? (
          <p className="empty">{t("empty")}</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t("colTitle")}</th>
                  <th>{t("colCategoria")}</th>
                  <th>{t("colPrioridad")}</th>
                  <th>{t("colEstado")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {/* User content — keep original language */}
                      <strong>{item.title}</strong>
                      {item.description && (
                        <div
                          style={{ color: "var(--muted)", fontSize: "0.85rem" }}
                        >
                          {item.description}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge">
                        {tl(`categoria.${item.categoria}`)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={
                          item.prioridad === "CRITICA" ||
                          item.prioridad === "ALTA"
                            ? "badge danger"
                            : "badge"
                        }
                      >
                        {tl(`prioridad.${item.prioridad}`)}
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
                        aria-label={t("estadoOf", { title: item.title })}
                      >
                        {ESTADOS.map((s) => (
                          <option key={s} value={s}>
                            {tl(`estado.${s}`)}
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
                        {tc("delete")}
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
