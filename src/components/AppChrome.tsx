"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { DbModeToggle } from "@/components/DbModeToggle";
import type { DbMode } from "@/lib/db-mode";

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

export function AppChrome({
  children,
  dbMode,
  desarrolloFile,
  produccionFile,
}: {
  children: React.ReactNode;
  dbMode: DbMode;
  desarrolloFile: string;
  produccionFile: string;
}) {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === "/";
  const isChat = pathname.startsWith("/chat");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  function HablarFab() {
    if (isChat) return null;
    return (
      <button
        type="button"
        className="hablar-fab"
        onClick={openHablar}
        aria-label={t("hablarAria")}
        data-testid="hablar-fab"
      >
        <span className="hablar-fab-inner">
          <IconMic />
        </span>
        <span className="hablar-fab-label">{t("hablar")}</span>
      </button>
    );
  }

  const drawerLinks = [
    { href: "/", label: t("home"), hint: t("homeHint") },
    { href: "/chat", label: t("chat"), hint: t("chatHint") },
    { href: "/pendientes", label: t("pendientes"), hint: t("pendientesHint") },
    { href: "/inventario", label: t("inventario"), hint: t("inventarioHint") },
    { href: "/produccion", label: t("produccion"), hint: t("produccionHint") },
    { href: "/recetas", label: t("fichas"), hint: t("fichasHint") },
    { href: "/menu", label: t("menuVentas"), hint: t("menuHint") },
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
    setDrawerOpen(false);
    router.push(`/chat?new=1&speak=1&t=${Date.now()}`);
  }

  return (
    <div className={`app-chrome ${isHome ? "is-home" : ""} ${isChat ? "is-chat" : ""}`}>
      <header className="top-brand">
        <button
          type="button"
          className={`menu-trigger ${drawerOpen ? "active" : ""}`}
          onClick={() => setDrawerOpen((v) => !v)}
          aria-expanded={drawerOpen}
          aria-controls="menu-drawer"
          aria-label={t("menuDrawer")}
        >
          <IconMenu open={drawerOpen} />
        </button>
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden />
          <span className="brand-name">Crunchadmin</span>
        </Link>
        <LocaleSwitcher />
      </header>

      <div className="app-main">{children}</div>

      {/* Portal-only FAB so WebGL/drei Html cannot cover it; mount after hydrate. */}
      {portalReady ? createPortal(<HablarFab />, document.body) : null}

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
            const active =
              l.href === "/"
                ? pathname === "/"
                : pathname === l.href || pathname.startsWith(`${l.href}/`);
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
        <div className="menu-drawer-foot">
          <DbModeToggle
            initialMode={dbMode}
            desarrolloFile={desarrolloFile}
            produccionFile={produccionFile}
          />
        </div>
      </aside>
    </div>
  );
}
