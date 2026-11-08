"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SpeakSheet } from "@/components/SpeakSheet";

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

      {speakOpen && (
        <SpeakSheet autoStart onClose={() => setSpeakOpen(false)} />
      )}
    </div>
  );
}
