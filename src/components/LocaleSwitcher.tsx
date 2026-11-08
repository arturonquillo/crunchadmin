"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocale } from "@/app/actions/locale";
import { locales, type Locale } from "@/i18n/config";

const LABEL_KEY: Record<Locale, "localeEs" | "localeEn" | "localePt"> = {
  es: "localeEs",
  en: "localeEn",
  pt: "localePt",
};

export function LocaleSwitcher() {
  const t = useTranslations("Nav");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(next: Locale) {
    if (next === locale) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <div className="locale-switcher" role="group" aria-label={t("localeLabel")}>
      {locales.map((code) => (
        <button
          key={code}
          type="button"
          className={
            code === locale ? "locale-btn active" : "locale-btn"
          }
          disabled={pending}
          onClick={() => onChange(code)}
          aria-pressed={code === locale}
        >
          {t(LABEL_KEY[code])}
        </button>
      ))}
    </div>
  );
}
