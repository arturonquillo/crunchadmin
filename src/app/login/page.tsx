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

  const [misconfigured, setMisconfigured] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((res) => res.json())
      .then(
        (data: {
          enabled: boolean;
          authenticated: boolean;
          misconfigured?: boolean;
        }) => {
          setMisconfigured(Boolean(data.misconfigured));
          setEnabled(data.enabled);
          if (data.authenticated && data.enabled) {
            const next = new URLSearchParams(window.location.search).get("next");
            window.location.replace(safeNextPath(next));
          }
        }
      )
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
      setError(
        res.status === 429
          ? "Demasiados intentos. Espera un momento e inténtalo de nuevo."
          : "Contraseña incorrecta"
      );
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next");
    window.location.assign(safeNextPath(next));
  }

  return (
    <div className="ops-page ops-login">
      <header className="ops-hero ops-hero--center">
        <p className="ops-kicker">Le Crunch · ops</p>
        <h1 className="ops-title">Entrar al panel</h1>
        <p className="ops-lede">
          Acceso al centro operativo: QR impresos, sitio y el día a día del local.
        </p>
      </header>

      <section className="ops-sheet ops-sheet--narrow ops-enter" aria-label="Inicio de sesión">
        {misconfigured && (
          <p className="notice">
            El servidor de producción no tiene <span className="url-code">ADMIN_PASSWORD</span>.
            Configúralo en el entorno y reinicia el servicio antes de usar el panel.
          </p>
        )}
        {!misconfigured && enabled === false && (
          <p className="notice">
            No hay contraseña configurada. El panel está abierto en este entorno. Define{" "}
            <span className="url-code">ADMIN_PASSWORD</span> antes de publicarlo.
          </p>
        )}
        {!misconfigured && enabled && (
          <form className="ops-form" onSubmit={onSubmit}>
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
              <button className="btn btn-touch" type="submit" disabled={sending}>
                {sending ? "Entrando…" : "Entrar"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
