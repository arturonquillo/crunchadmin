"use client";

import { useTranslations } from "next-intl";

export default function AjustesPage() {
  const t = useTranslations("Ajustes");

  return (
    <div className="shell">
      <h1 className="section-title">{t("title")}</h1>
      <p className="section-sub">{t("subtitle")}</p>
      <section className="panel">
        <ul className="inv-list">
          <li className="inv-row">
            <div>
              <strong>{t("language")}</strong>
              <div className="inv-meta">{t("languageMeta")}</div>
            </div>
          </li>
          <li className="inv-row">
            <div>
              <strong>{t("openai")}</strong>
              <div className="inv-meta">{t("openaiMeta")}</div>
            </div>
          </li>
          <li className="inv-row">
            <div>
              <strong>{t("operator")}</strong>
              <div className="inv-meta">{t("operatorMeta")}</div>
            </div>
          </li>
        </ul>
      </section>
    </div>
  );
}
