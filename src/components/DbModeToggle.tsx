"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { setDbMode } from "@/app/actions/db-mode";
import type { DbMode } from "@/lib/db-mode";

export function DbModeToggle({
  initialMode,
  desarrolloFile,
  produccionFile,
}: {
  initialMode: DbMode;
  desarrolloFile: string;
  produccionFile: string;
}) {
  const t = useTranslations("Nav");
  const router = useRouter();
  const [mode, setMode] = useState<DbMode>(initialMode);
  const [pending, startTransition] = useTransition();

  const activeFile = mode === "produccion" ? produccionFile : desarrolloFile;

  function switchMode(next: DbMode) {
    if (next === mode || pending) return;
    startTransition(async () => {
      const applied = await setDbMode(next);
      setMode(applied);
      router.refresh();
      window.location.reload();
    });
  }

  return (
    <div className="db-mode-toggle" data-mode={mode}>
      <p className="db-mode-label">{t("dbMode")}</p>
      <div className="db-mode-switch" role="group" aria-label={t("dbMode")}>
        <button
          type="button"
          className={mode === "desarrollo" ? "active" : ""}
          disabled={pending}
          onClick={() => switchMode("desarrollo")}
        >
          {t("dbDesarrollo")}
        </button>
        <button
          type="button"
          className={mode === "produccion" ? "active" : ""}
          disabled={pending}
          onClick={() => switchMode("produccion")}
        >
          {t("dbProduccion")}
        </button>
      </div>
      <p className="db-mode-file">
        {t("dbActive")}: <code>{activeFile}</code>
      </p>
    </div>
  );
}
