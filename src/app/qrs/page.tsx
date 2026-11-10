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
    <>
      <h1 className="section-title">Códigos QR</h1>
      <p className="section-sub">
        Cada código impreso apunta a un enlace corto. Si el destino cambia, se
        actualiza aquí y no hace falta volver a imprimir.
      </p>

      <section className="panel">
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Nuevo código</h2>
        <p className="section-sub" style={{ marginBottom: "0.8rem" }}>
          Ejemplo: <span className="url-code">lecrunch.com.br/qr/abc123</span> abre
          Instagram, la carta o la dirección que indiques.
        </p>
        <form onSubmit={onCreate}>
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
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="qr-url">Destino</label>
              <input
                id="qr-url"
                required
                placeholder="instagram.com/_lecrunch"
                value={form.destinationUrl}
                onChange={(e) => setForm({ ...form, destinationUrl: e.target.value })}
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
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
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "Creando…" : "Crear QR"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        {loading ? (
          <p className="empty">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="empty">Todavía no hay códigos. Crea el primero arriba.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Enlace impreso</th>
                  <th>Destino</th>
                  <th>Lecturas</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      <div>
                        {item.active ? (
                          <span className="badge">Activo</span>
                        ) : (
                          <span className="badge warn">En pausa</span>
                        )}
                      </div>
                    </td>
                    <td className="url-code">{item.shortUrl.replace(/^https?:\/\//, "")}</td>
                    <td className="url-code">{item.destinationUrl}</td>
                    <td>
                      <strong>{item.scanCount}</strong>
                      {item.lastScannedAt && (
                        <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                          {formatWhen(item.lastScannedAt)}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="form-actions" style={{ marginTop: 0 }}>
                        <Link className="btn small" href={`/qrs/${item.id}`}>
                          Abrir
                        </Link>
                        <button
                          type="button"
                          className="btn secondary small"
                          onClick={() => toggle(item)}
                        >
                          {item.active ? "Pausar" : "Activar"}
                        </button>
                      </div>
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
