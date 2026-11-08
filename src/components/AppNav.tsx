"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/pendientes", label: "Pendientes" },
  { href: "/recetas", label: "Recetas" },
  { href: "/menu", label: "Menú" },
  { href: "/chat", label: "Chat" },
];

export function AppNav() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <header className={isHome ? "site-header home-overlay-nav" : "site-header"}>
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
        </nav>
      </div>
    </header>
  );
}
