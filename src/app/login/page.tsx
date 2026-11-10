"use client";

import { FormEvent, useEffect, useState } from "react";

function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((res) => res.json())
      .then((data: { enabled: boolean; authenticated: boolean }) => {
        setEnabled(data.enabled);
        if (data.authenticated && data.enabled) {
          const next = new URLSearchParams(window.location.search).get("next");
          window.location.replace(safeNextPath(next));
        }
      })
      .catch(() => setEnabled(false));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setSending(false);
    if (!res.ok) {
      setError("Contraseña incorrecta");
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next");
    window.location.assign(safeNextPath(next));
  }

  return (
    <>
      <h1 className="section-title">Entrar</h1>
      <p className="section-sub">Panel de Le Crunch.</p>
      <section className="panel" style={{ maxWidth: 420 }}>
        {enabled === false && (
          <p className="notice">
            No hay contraseña configurada. El panel está abierto en este entorno. Define{" "}
            <span className="url-code">ADMIN_PASSWORD</span> antes de publicarlo.
          </p>
        )}
        {enabled && (
          <form onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <button className="btn" type="submit" disabled={sending}>
                {sending ? "Entrando…" : "Entrar"}
              </button>
            </div>
          </form>
        )}
      </section>
    </>
  );
}
