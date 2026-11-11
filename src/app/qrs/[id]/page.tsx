"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { formatDayLabel, formatWhen } from "@/lib/qr";

type Change = {
  id: string;
  fromUrl: string;
  toUrl: string;
  createdAt: string;
};

type Scan = {
  id: string;
  createdAt: string;
  agent: string;
};

type Daily = { day: string; count: number };

type QrDetail = {
  id: string;
  code: string;
  name: string;
  notes: string | null;
  destinationUrl: string;
  shortUrl: string;
  active: boolean;
  scanCount: number;
  lastScannedAt: string | null;
  changes: Change[];
  latestScans: Scan[];
  daily: Daily[];
};

export default function QrDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [qr, setQr] = useState<QrDetail | null>(null);
  const [destination, setDestination] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/qrs/${params.id}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "No encontrado");
      return;
    }
    setQr(data);
    setDestination(data.destinationUrl);
    setName(data.name);
    setNotes(data.notes ?? "");
  }, [params.id]);

  useEffect(() => {
    load().catch((e) => setError(String(e)));
  }, [load]);

  async function patch(body: Record<string, unknown>, message: string) {
    setError(null);
    setSaved(null);
    const res = await fetch(`/api/qrs/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "No se pudo guardar");
      return;
    }
    setSaved(message);
    await load();
  }

  async function onDestination(e: FormEvent) {
    e.preventDefault();
    await patch({ destinationUrl: destination }, "Destino actualizado. El QR impreso sigue igual.");
  }

  async function onMeta(e: FormEvent) {
    e.preventDefault();
    await patch({ name, notes }, "Datos guardados.");
  }

  async function copyLink() {
    if (!qr) return;
    await navigator.clipboard.writeText(qr.shortUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function remove() {
    if (!qr) return;
    if (!confirm("¿Eliminar este QR? Si ya está impreso, dejará de funcionar.")) return;
    await fetch(`/api/qrs/${qr.id}`, { method: "DELETE" });
    router.push("/qrs");
  }

  if (!qr) {
    return (
      <div className="ops-page">
        <header className="ops-hero">
          <p className="ops-kicker">Código QR</p>
          <h1 className="ops-title">Cargando…</h1>
        </header>
        <p className={error ? "form-error" : "empty"}>{error || "Cargando…"}</p>
      </div>
    );
  }

  const maxDaily = Math.max(1, ...qr.daily.map((day) => day.count));

  return (
    <div className="ops-page">
      <p className="ops-back">
        <Link href="/qrs">← Códigos QR</Link>
      </p>
      <header className="ops-hero">
        <p className="ops-kicker">{qr.active ? "Enlace activo" : "En pausa"}</p>
        <h1 className="ops-title">{qr.name}</h1>
        <p className="ops-lede">
          El código impreso abre siempre el enlace corto. Cambia el destino cuando
          quieras, sin reimprimir.
        </p>
      </header>
      {error && <p className="form-error">{error}</p>}
      {saved && <p className="form-ok">{saved}</p>}

      <div className="qr-layout ops-enter">
        <section className="ops-sheet qr-preview" aria-label="Vista previa del QR">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/qrs/${qr.id}/png`} alt={`QR ${qr.code}`} width={1024} height={1024} />
          <p className="url-code qr-preview-url">
            {qr.shortUrl.replace(/^https?:\/\//, "")}
          </p>
          <div className="form-actions">
            <button type="button" className="btn secondary small btn-touch" onClick={copyLink}>
              {copied ? "Copiado" : "Copiar enlace"}
            </button>
            <a className="btn secondary small btn-touch" href={`/api/qrs/${qr.id}/png?download=1`}>
              Descargar PNG
            </a>
            <Link className="btn secondary small btn-touch" href={`/qrs/${qr.id}/imprimir`}>
              Imprimir
            </Link>
          </div>
        </section>

        <div className="qr-detail-stack">
          <section className="ops-sheet">
            <div className="ops-stat-row">
              <div className="ops-stat">
                <strong>{qr.scanCount}</strong>
                <span>Lecturas</span>
              </div>
              <div className="ops-stat">
                <strong className="ops-stat-text">
                  {qr.lastScannedAt ? formatWhen(qr.lastScannedAt) : "—"}
                </strong>
                <span>Última (Maceió)</span>
              </div>
              <div className="ops-stat">
                <strong className="ops-stat-text">{qr.active ? "Activo" : "En pausa"}</strong>
                <span>Estado</span>
              </div>
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="btn secondary btn-touch"
                onClick={() =>
                  patch(
                    { active: !qr.active },
                    qr.active ? "Código pausado." : "Código activado."
                  )
                }
              >
                {qr.active ? "Pausar" : "Activar"}
              </button>
              <button type="button" className="btn danger btn-touch" onClick={remove}>
                Eliminar
              </button>
            </div>
          </section>

          <section className="ops-sheet">
            <div className="ops-sheet-head">
              <h2 className="ops-sheet-title">Destino</h2>
            </div>
            <p className="notice">
              Lo impreso es <span className="url-code">{qr.shortUrl.replace(/^https?:\/\//, "")}</span>.
              Si el servicio cambia de dirección, guarda el destino nuevo aquí.
            </p>
            <form className="ops-form" onSubmit={onDestination}>
              <div className="field" style={{ marginTop: "0.8rem" }}>
                <label htmlFor="destination">URL de destino</label>
                <input
                  id="destination"
                  required
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                />
              </div>
              <div className="form-actions">
                <button className="btn btn-touch" type="submit">
                  Guardar destino
                </button>
              </div>
            </form>
            {qr.changes.length > 0 && (
              <div className="version-list" style={{ marginTop: "0.9rem" }}>
                {qr.changes.map((change) => (
                  <div key={change.id} className="version-item">
                    <div className="field-hint">{formatWhen(change.createdAt)}</div>
                    <div className="url-code">{change.fromUrl}</div>
                    <div className="url-code">→ {change.toUrl}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <section className="ops-sheet ops-enter ops-enter-delay">
        <div className="ops-sheet-head">
          <h2 className="ops-sheet-title">Lecturas por día</h2>
          <p className="ops-sheet-sub">Últimos 14 días, hora de Maceió.</p>
        </div>
        <div className="day-bars" aria-hidden>
          {qr.daily.map((day) => (
            <span
              key={day.day}
              title={`${formatDayLabel(day.day)}: ${day.count}`}
              style={{ height: `${Math.max(4, (day.count / maxDaily) * 100)}%` }}
            />
          ))}
        </div>
        <div className="day-labels">
          {qr.daily.map((day) => (
            <span key={day.day}>{day.count > 0 ? day.count : ""}</span>
          ))}
        </div>
      </section>

      <section className="ops-sheet ops-enter ops-enter-delay">
        <div className="ops-sheet-head">
          <h2 className="ops-sheet-title">Nombre y notas</h2>
        </div>
        <form className="ops-form" onSubmit={onMeta}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="meta-name">Nombre</label>
              <input id="meta-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field field-span">
              <label htmlFor="meta-notes">Dónde está impreso</label>
              <textarea id="meta-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn secondary btn-touch" type="submit">
              Guardar datos
            </button>
          </div>
        </form>
      </section>

      <section className="ops-sheet ops-enter ops-enter-delay">
        <div className="ops-sheet-head">
          <h2 className="ops-sheet-title">Últimas lecturas</h2>
        </div>
        {qr.latestScans.length === 0 ? (
          <p className="empty">Todavía no hubo lecturas.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Cuándo</th>
                  <th>Dispositivo</th>
                </tr>
              </thead>
              <tbody>
                {qr.latestScans.map((scan) => (
                  <tr key={scan.id}>
                    <td>{formatWhen(scan.createdAt)}</td>
                    <td>{scan.agent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
