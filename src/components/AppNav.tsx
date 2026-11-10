"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/pendientes", label: "Pendientes" },
  { href: "/recetas", label: "Recetas" },
  { href: "/menu", label: "Menú" },
  { href: "/qrs", label: "QR" },
  { href: "/sitio", label: "Sitio" },
  { href: "/chat", label: "Chat" },
];

export function AppNav() {
  const pathname = usePathname();
  const [canLogout, setCanLogout] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((res) => res.json())
      .then((data: { enabled?: boolean; authenticated?: boolean }) => {
        setCanLogout(Boolean(data.enabled && data.authenticated));
      })
      .catch(() => setCanLogout(false));
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden />
          <span className="brand-name">Crunchadmin</span>
        </Link>
        <nav className="nav-links" aria-label="Principal">
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={active ? "nav-link active" : "nav-link"}
              >
                {l.label}
              </Link>
            );
          })}
          {canLogout && (
            <button type="button" className="nav-link nav-button" onClick={logout}>
              Salir
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
