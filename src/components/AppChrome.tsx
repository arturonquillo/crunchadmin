"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

const DRAWER_LINKS = [
  { href: "/pendientes", label: "Pendientes", hint: "Trabajo por zona" },
  {
    href: "/recetas",
    label: "Fichas técnicas",
    hint: "Recetas y escalado",
  },
  { href: "/produccion", label: "Producción", hint: "Batches y descuentos" },
  { href: "/menu", label: "Menú de ventas", hint: "Plataformas" },
  { href: "/chat", label: "Chat histórico", hint: "Conversaciones" },
  { href: "/ajustes", label: "Ajustes", hint: "Preferencias (stub)" },
];

function IconMenu({ open }: { open?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      {open ? (
        <path
          d="M6 6l12 12M18 6L6 18"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M4 7h16M4 12h16M4 17h12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function IconHome() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBox() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 12 20 7.5M12 12v9M12 12 4 7.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconMic() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 11a7 7 0 0 0 14 0M12 18v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [speakOpen, setSpeakOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
    setSpeakOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle("drawer-open", drawerOpen);
    return () => document.body.classList.remove("drawer-open");
  }, [drawerOpen]);

  return (
    <div className={`app-chrome ${isHome ? "is-home" : ""}`}>
      <header className="top-brand">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden />
          <span className="brand-name">Crunchadmin</span>
        </Link>
      </header>

      <div className="app-main">{children}</div>

      <nav className="bottom-nav" aria-label="Principal">
        <button
          type="button"
          className={`bn-item ${drawerOpen ? "active" : ""}`}
          onClick={() => setDrawerOpen((v) => !v)}
          aria-expanded={drawerOpen}
          aria-controls="menu-drawer"
        >
          <IconMenu open={drawerOpen} />
          <span>Menú</span>
        </button>

        <Link href="/" className={`bn-item ${isHome ? "active" : ""}`}>
          <IconHome />
          <span>Inicio</span>
        </Link>

        <button
          type="button"
          className={`bn-speak ${speakOpen ? "active" : ""}`}
          onClick={() => setSpeakOpen(true)}
          aria-label="Informar al sistema"
        >
          <span className="bn-speak-inner">
            <IconMic />
          </span>
          <span className="bn-speak-label">Hablar</span>
        </button>

        <Link
          href="/inventario"
          className={`bn-item ${pathname.startsWith("/inventario") ? "active" : ""}`}
        >
          <IconBox />
          <span>Inventario</span>
        </Link>
      </nav>

      <div
        className={`drawer-backdrop ${drawerOpen ? "open" : ""}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden={!drawerOpen}
      />
      <aside
        id="menu-drawer"
        className={`menu-drawer ${drawerOpen ? "open" : ""}`}
        aria-hidden={!drawerOpen}
      >
        <div className="menu-drawer-head">
          <p className="menu-drawer-kicker">Menú</p>
          <h2>Destinos</h2>
          <button type="button" className="btn ghost" onClick={() => setDrawerOpen(false)}>
            Cerrar
          </button>
        </div>
        <ul className="menu-drawer-list">
          {DRAWER_LINKS.map((l) => {
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={active ? "drawer-link active" : "drawer-link"}
                  onClick={() => setDrawerOpen(false)}
                >
                  <span className="drawer-link-label">{l.label}</span>
                  <span className="drawer-link-hint">{l.hint}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </aside>

      {speakOpen && <SpeakSheet onClose={() => setSpeakOpen(false)} />}
    </div>
  );
}

function SpeakSheet({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  function startMic() {
    const SR =
      typeof window !== "undefined"
        ? (window as unknown as {
            SpeechRecognition?: new () => SpeechRecognitionLike;
            webkitSpeechRecognition?: new () => SpeechRecognitionLike;
          }).SpeechRecognition ||
          (window as unknown as {
            webkitSpeechRecognition?: new () => SpeechRecognitionLike;
          }).webkitSpeechRecognition
        : undefined;

    if (!SR) {
      setStatus("Tu navegador no soporta dictado. Escribe el mensaje abajo.");
      return;
    }

    const recognition = new SR();
    recognition.lang = "es-ES";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => {
      setListening(true);
      setStatus("Escuchando…");
    };
    recognition.onerror = () => {
      setListening(false);
      setStatus("No se pudo capturar audio. Usa el texto.");
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognition.onresult = (event: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => {
      const said = event.results[0]?.[0]?.transcript ?? "";
      if (said) setText((prev) => (prev ? `${prev} ${said}` : said));
      setStatus(null);
    };
    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopMic() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setReply(null);
    setStatus(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), source: "speak" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || "Error al enviar");
        return;
      }
      setReply(data.assistantMessage?.content || "Registrado.");
      setText("");
    } catch (err) {
      setStatus(String(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="speak-sheet-root" role="dialog" aria-modal="true" aria-label="Informar al sistema">
      <div className="speak-backdrop" onClick={onClose} />
      <div className="speak-sheet">
        <div className="speak-sheet-head">
          <div>
            <p className="zone-sheet-kicker">Asistente</p>
            <h2>Decile al sistema</h2>
          </div>
          <button type="button" className="btn ghost" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <p className="section-sub" style={{ marginTop: 0 }}>
          Ej.: «quedan 8 L de aceite» o «recibí 5 kg de frango». Se guarda en el chat y actualiza
          inventario si reconoce el insumo.
        </p>
        <form onSubmit={onSubmit} className="speak-form">
          <div className="speak-mic-row">
            <button
              type="button"
              className={`btn speak-mic-btn ${listening ? "listening" : ""}`}
              onClick={listening ? stopMic : startMic}
            >
              <IconMic />
              {listening ? "Detener" : "Dictar"}
            </button>
          </div>
          <div className="field">
            <label htmlFor="speak-text">Mensaje</label>
            <textarea
              id="speak-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Escribí o dictá lo que querés informar…"
              rows={3}
              autoFocus
            />
          </div>
          {status && <p className="error">{status}</p>}
          {reply && <p className="speak-reply">{reply}</p>}
          <div className="form-actions">
            <button className="btn" type="submit" disabled={sending || !text.trim()}>
              {sending ? "Enviando…" : "Enviar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
  start: () => void;
  stop: () => void;
};
