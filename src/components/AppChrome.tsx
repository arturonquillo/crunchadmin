"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

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
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === "/";
  const isChat = pathname.startsWith("/chat");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const drawerLinks = [
    { href: "/pendientes", label: t("pendientes"), hint: t("pendientesHint") },
    { href: "/recetas", label: t("fichas"), hint: t("fichasHint") },
    { href: "/produccion", label: t("produccion"), hint: t("produccionHint") },
    { href: "/menu", label: t("menuVentas"), hint: t("menuHint") },
    { href: "/chat", label: t("chat"), hint: t("chatHint") },
    { href: "/ajustes", label: t("ajustes"), hint: t("ajustesHint") },
  ];

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle("drawer-open", drawerOpen);
    return () => document.body.classList.remove("drawer-open");
  }, [drawerOpen]);

  function openHablar() {
    // Always a fresh conversation ready to speak.
    router.push(`/chat?new=1&speak=1&t=${Date.now()}`);
  }

  return (
    <div className={`app-chrome ${isHome ? "is-home" : ""} ${isChat ? "is-chat" : ""}`}>
      <header className="top-brand">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden />
          <span className="brand-name">Crunchadmin</span>
        </Link>
        <LocaleSwitcher />
      </header>

      <div className="app-main">{children}</div>

      <nav className="bottom-nav" aria-label={t("aria")}>
        <button
          type="button"
          className={`bn-item ${drawerOpen ? "active" : ""}`}
          onClick={() => setDrawerOpen((v) => !v)}
          aria-expanded={drawerOpen}
          aria-controls="menu-drawer"
        >
          <IconMenu open={drawerOpen} />
          <span>{t("menu")}</span>
        </button>

        <Link href="/" className={`bn-item ${isHome ? "active" : ""}`}>
          <IconHome />
          <span>{t("home")}</span>
        </Link>

        <button
          type="button"
          className={`bn-speak ${isChat ? "active" : ""}`}
          onClick={openHablar}
          aria-label={t("hablarAria")}
        >
          <span className="bn-speak-inner">
            <IconMic />
          </span>
          <span className="bn-speak-label">{t("hablar")}</span>
        </button>

        <Link
          href="/inventario"
          className={`bn-item ${pathname.startsWith("/inventario") ? "active" : ""}`}
        >
          <IconBox />
          <span>{t("inventario")}</span>
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
          <p className="menu-drawer-kicker">{t("menuDrawer")}</p>
          <h2>{t("destinations")}</h2>
          <button type="button" className="btn ghost" onClick={() => setDrawerOpen(false)}>
            {t("close")}
          </button>
        </div>
        <ul className="menu-drawer-list">
          {drawerLinks.map((l) => {
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
    </div>
  );
}
