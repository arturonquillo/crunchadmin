"use client";

import { FormEvent, useEffect, useState } from "react";

type SiteForm = {
  name: string;
  tagline: string;
  description: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  hours: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  mapsUrl: string;
  announcement: string;
};

const EMPTY: SiteForm = {
  name: "",
  tagline: "",
  description: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  hours: "",
  instagram: "",
  facebook: "",
  tiktok: "",
  mapsUrl: "",
  announcement: "",
};

const FIELDS: { key: keyof SiteForm; label: string; hint?: string; area?: boolean }[] = [
  { key: "name", label: "Nombre" },
  { key: "tagline", label: "Bajada", hint: "Frase corta bajo el nombre" },
  { key: "description", label: "Descripción", area: true },
  { key: "phone", label: "Teléfono" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "Email" },
  { key: "address", label: "Dirección", area: true },
  { key: "hours", label: "Horario", hint: "Texto libre. Ejemplo: mar a dom, 18 a 23", area: true },
  { key: "instagram", label: "Instagram", hint: "URL o usuario" },
  { key: "facebook", label: "Facebook" },
  { key: "tiktok", label: "TikTok" },
  { key: "mapsUrl", label: "Enlace del mapa", hint: "https://maps.google.com/…" },
  {
    key: "announcement",
    label: "Aviso",
    hint: "Si lo dejas vacío, el sitio puede ocultar la franja de aviso",
    area: true,
  },
];

export default function SitioPage() {
  const [form, setForm] = useState<SiteForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/site")
      .then((res) => res.json())
      .then((data) => {
        const next = { ...EMPTY };
        for (const field of FIELDS) next[field.key] = data[field.key] ?? "";
        setForm(next);
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/site", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "No se pudo guardar");
      return;
    }
    setSaved(true);
  }

  return (
    <div className="ops-page">
      <header className="ops-hero">
        <p className="ops-kicker">Datos públicos</p>
        <h1 className="ops-title">Sitio</h1>
        <p className="ops-lede">
          Nombre, contacto, horario y redes. El sitio público puede leerlos en{" "}
          <span className="url-code">/api/public/site</span>.
        </p>
      </header>

      <section className="ops-sheet ops-enter" aria-label="Editar sitio">
        {loading ? (
          <p className="empty">Cargando…</p>
        ) : (
          <form className="ops-form" onSubmit={onSubmit}>
            <div className="form-grid">
              {FIELDS.map((field) => (
                <div
                  key={field.key}
                  className={`field${field.area ? " field-span" : ""}`}
                >
                  <label htmlFor={field.key}>{field.label}</label>
                  {field.area ? (
                    <textarea
                      id={field.key}
                      value={form[field.key]}
                      onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                    />
                  ) : (
                    <input
                      id={field.key}
                      value={form[field.key]}
                      onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                    />
                  )}
                  {field.hint && <span className="field-hint">{field.hint}</span>}
                </div>
              ))}
            </div>
            {error && <p className="form-error">{error}</p>}
            {saved && <p className="form-ok">Cambios guardados.</p>}
            <div className="form-actions">
              <button className="btn btn-touch" type="submit" disabled={saving}>
                {saving ? "Guardando…" : "Guardar sitio"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
