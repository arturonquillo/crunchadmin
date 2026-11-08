"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

export function AppNav() {
  const pathname = usePathname();
  const t = useTranslations("Nav");

  const links = [
    { href: "/", label: t("home") },
    { href: "/pendientes", label: t("pendientes") },
    { href: "/recetas", label: t("recetas") },
    { href: "/menu", label: t("menu") },
    { href: "/chat", label: t("chat") },
  ];

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden />
          <span className="brand-name">Crunchadmin</span>
        </Link>
        <div className="nav-trail">
          <nav className="nav-links" aria-label={t("aria")}>
            {links.map((l) => {
              const active =
                l.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(l.href);
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
          <LocaleSwitcher />
        </div>
      </div>
    </header>
  );
}
