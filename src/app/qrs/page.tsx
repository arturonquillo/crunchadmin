"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { formatWhen } from "@/lib/qr";

type QrItem = {
  id: string;
  code: string;
  name: string;
  destinationUrl: string;
  shortUrl: string;
  active: boolean;
  scanCount: number;
  lastScannedAt: string | null;
};

const emptyForm = { name: "", destinationUrl: "", code: "", notes: "" };

export default function QrsPage() {
  const router = useRouter();
  const [items, setItems] = useState<QrItem[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/qrs");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "No se pudieron cargar los códigos");
      setLoading(false);
      return;
    }
    setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch((e) => setError(String(e)));
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/qrs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "No se pudo crear el código");
      return;
    }
    router.push(`/qrs/${data.id}`);
  }

  async function toggle(item: QrItem) {
    await fetch(`/api/qrs/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !item.active }),
    });
    await load();
  }

  return (
    <div className="ops-page">
      <header className="ops-hero">
        <p className="ops-kicker">Enlaces impresos</p>
        <h1 className="ops-title">Códigos QR</h1>
        <p className="ops-lede">
          Cada código impreso apunta a un enlace corto fijo. Si el destino cambia, se
          actualiza aquí — sin reimprimir.
        </p>
      </header>

      <section className="ops-sheet ops-enter" aria-label="Crear código">
        <div className="ops-sheet-head">
          <h2 className="ops-sheet-title">Nuevo código</h2>
          <p className="ops-sheet-sub">
            Ejemplo: <span className="url-code">lecrunch.com.br/qr/abc123</span> abre
            Instagram, la carta o la dirección que indiques.
          </p>
        </div>
        <form className="ops-form" onSubmit={onCreate}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="qr-name">Nombre</label>
              <input
                id="qr-name"
                required
                placeholder="Instagram del local"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="qr-code">Código corto</label>
              <input
                id="qr-code"
                placeholder="abc123 (opcional)"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>
            <div className="field field-span">
              <label htmlFor="qr-url">Destino</label>
              <input
                id="qr-url"
                required
                placeholder="instagram.com/_lecrunch"
                value={form.destinationUrl}
                onChange={(e) => setForm({ ...form, destinationUrl: e.target.value })}
              />
            </div>
            <div className="field field-span">
              <label htmlFor="qr-notes">Notas</label>
              <input
                id="qr-notes"
                placeholder="Dónde está impreso: mesas, vidriera, packaging"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="form-actions">
            <button className="btn btn-touch" type="submit" disabled={saving}>
              {saving ? "Creando…" : "Crear QR"}
            </button>
          </div>
        </form>
      </section>

      <section className="ops-list-block ops-enter ops-enter-delay" aria-label="Lista de códigos">
        <div className="ops-sheet-head ops-sheet-head--flush">
          <h2 className="ops-sheet-title">Activos e impresos</h2>
          <p className="ops-sheet-sub">
            {loading ? "Cargando…" : `${items.length} código${items.length === 1 ? "" : "s"}`}
          </p>
        </div>

        {loading ? (
          <p className="empty">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="empty">Todavía no hay códigos. Crea el primero arriba.</p>
        ) : (
          <ul className="qr-list">
            {items.map((item, index) => (
              <li
                key={item.id}
                className="qr-row"
                style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
              >
                <div className="qr-row-main">
                  <div className="qr-row-title">
                    <strong>{item.name}</strong>
                    {item.active ? (
                      <span className="badge">Activo</span>
                    ) : (
                      <span className="badge warn">En pausa</span>
                    )}
                  </div>
                  <p className="url-code qr-row-short">
                    {item.shortUrl.replace(/^https?:\/\//, "")}
                  </p>
                  <p className="url-code qr-row-dest">{item.destinationUrl}</p>
                </div>
                <div className="qr-row-meta">
                  <div className="qr-row-scans">
                    <strong>{item.scanCount}</strong>
                    <span>lecturas</span>
                    {item.lastScannedAt && (
                      <span className="qr-row-when">{formatWhen(item.lastScannedAt)}</span>
                    )}
                  </div>
                  <div className="form-actions qr-row-actions">
                    <Link className="btn small btn-touch" href={`/qrs/${item.id}`}>
                      Abrir
                    </Link>
                    <button
                      type="button"
                      className="btn secondary small btn-touch"
                      onClick={() => toggle(item)}
                    >
                      {item.active ? "Pausar" : "Activar"}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
