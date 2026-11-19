"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  ConnectionStatus,
  DatePreset,
  HierarchyCampaign,
  HierarchyPayload,
  InsightsMetrics,
} from "@/lib/meta/types";

type StatusPayload = ConnectionStatus & {
  graphVersion?: string;
  redirectUri?: string;
  realOAuthAvailable?: boolean;
};

function MetricCell({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="ads-metric">
      <span className="ads-metric-label">{label}</span>
      <span className="ads-metric-value">{value}</span>
    </div>
  );
}

function fmtMoney(n: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

function fmtMetrics(m: InsightsMetrics, currency: string, t: (k: string) => string) {
  return {
    spend: fmtMoney(m.spend, currency),
    ctr: m.ctr != null ? `${m.ctr.toFixed(2)}%` : t("dash"),
    cpc: m.cpc != null ? fmtMoney(m.cpc, currency) : t("dash"),
    cpa:
      m.cpa != null
        ? `${fmtMoney(m.cpa, currency)}${m.cpaAction ? ` (${m.cpaAction})` : ""}`
        : t("dash"),
    clicks: m.clicks.toLocaleString(),
    impressions: m.impressions.toLocaleString(),
  };
}

export function AdsConsole() {
  const t = useTranslations("Ads");
  const tc = useTranslations("Common");
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [hierarchy, setHierarchy] = useState<HierarchyPayload | null>(null);
  const [preset, setPreset] = useState<DatePreset>("last_7d");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openCamps, setOpenCamps] = useState<Record<string, boolean>>({});
  const [report, setReport] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/ads/status");
    const data = (await res.json()) as StatusPayload;
    setStatus(data);
    return data;
  }, []);

  const loadHierarchy = useCallback(async (p: DatePreset) => {
    const res = await fetch(`/api/ads/hierarchy?date_preset=${p}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t("loadError"));
    setHierarchy(data as HierarchyPayload);
    const open: Record<string, boolean> = {};
    for (const c of (data as HierarchyPayload).campaigns || []) {
      open[c.id] = true;
    }
    setOpenCamps(open);
  }, [t]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const st = await loadStatus();
      if (st.connected) await loadHierarchy(preset);
      else setHierarchy(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [loadHierarchy, loadStatus, preset, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) setError(err);
  }, []);

  async function connectMock() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ads/mock/connect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("connectError"));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("connectError"));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm(t("disconnectConfirm"))) return;
    setBusy(true);
    try {
      await fetch("/api/ads/disconnect", { method: "POST" });
      setHierarchy(null);
      setReport(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function selectAccount(actId: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/ads/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("selectError"));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("selectError"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(objectId: string, current: string) {
    const next = current === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setBusy(true);
    try {
      const res = await fetch("/api/ads/object-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectId, status: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("statusError"));
      await loadHierarchy(preset);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("statusError"));
    } finally {
      setBusy(false);
    }
  }

  async function loadReport() {
    setBusy(true);
    try {
      const res = await fetch("/api/ads/daily-report");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("reportError"));
      setReport(data.bodyMarkdown as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("reportError"));
    } finally {
      setBusy(false);
    }
  }

  const totalsFmt = useMemo(() => {
    if (!hierarchy) return null;
    return fmtMetrics(hierarchy.totals, hierarchy.currency, tc);
  }, [hierarchy, tc]);

  function renderCampaign(c: HierarchyCampaign) {
    const open = openCamps[c.id];
    const m = fmtMetrics(c.metrics, hierarchy!.currency, tc);
    return (
      <li key={c.id} className="ads-camp">
        <div className="ads-row">
          <button
            type="button"
            className="ads-expand"
            aria-expanded={open}
            onClick={() => setOpenCamps((s) => ({ ...s, [c.id]: !s[c.id] }))}
          >
            {open ? "▾" : "▸"}
          </button>
          <div className="ads-row-main">
            <strong>{c.name}</strong>
            <span className={`ads-pill ${c.status === "ACTIVE" ? "on" : "off"}`}>
              {c.status}
            </span>
            {c.objective ? <span className="ads-muted">{c.objective}</span> : null}
          </div>
          <div className="ads-row-metrics">
            <span>{m.spend}</span>
            <span>CTR {m.ctr}</span>
            <span>CPC {m.cpc}</span>
          </div>
          <button
            type="button"
            className="btn ghost"
            disabled={busy}
            onClick={() => void toggleStatus(c.id, c.status)}
          >
            {c.status === "ACTIVE" ? t("pause") : t("enable")}
          </button>
        </div>
        {open
          ? c.adsets.map((as) => {
              const am = fmtMetrics(as.metrics, hierarchy!.currency, tc);
              return (
                <div key={as.id} className="ads-adset">
                  <div className="ads-row nested">
                    <div className="ads-row-main">
                      <strong>{as.name}</strong>
                      <span
                        className={`ads-pill ${as.status === "ACTIVE" ? "on" : "off"}`}
                      >
                        {as.status}
                      </span>
                      {as.dailyBudget != null ? (
                        <span className="ads-muted">
                          {t("dailyBudget")}:{" "}
                          {fmtMoney(as.dailyBudget / 100, hierarchy!.currency)}
                        </span>
                      ) : null}
                    </div>
                    <div className="ads-row-metrics">
                      <span>{am.spend}</span>
                      <span>CTR {am.ctr}</span>
                      <span>CPA {am.cpa}</span>
                    </div>
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={busy}
                      onClick={() => void toggleStatus(as.id, as.status)}
                    >
                      {as.status === "ACTIVE" ? t("pause") : t("enable")}
                    </button>
                  </div>
                  <ul className="ads-ads">
                    {as.ads.map((ad) => {
                      const adm = fmtMetrics(ad.metrics, hierarchy!.currency, tc);
                      return (
                        <li key={ad.id} className="ads-row nested deep">
                          <div className="ads-row-main">
                            <span>{ad.name}</span>
                            <span
                              className={`ads-pill ${ad.status === "ACTIVE" ? "on" : "off"}`}
                            >
                              {ad.status}
                            </span>
                            {ad.creativeName ? (
                              <span className="ads-muted">{ad.creativeName}</span>
                            ) : null}
                          </div>
                          <div className="ads-row-metrics">
                            <span>{adm.spend}</span>
                            <span>CTR {adm.ctr}</span>
                            <span>CPC {adm.cpc}</span>
                          </div>
                          <button
                            type="button"
                            className="btn ghost"
                            disabled={busy}
                            onClick={() => void toggleStatus(ad.id, ad.status)}
                          >
                            {ad.status === "ACTIVE" ? t("pause") : t("enable")}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          : null}
      </li>
    );
  }

  return (
    <div className="shell ads-shell">
      <div className="page-head">
        <div>
          <h1 className="section-title">{t("title")}</h1>
          <p className="section-sub">{t("subtitle")}</p>
        </div>
      </div>

      {error ? <p className="banner error">{error}</p> : null}

      {loading ? (
        <p className="section-sub">{tc("loading")}</p>
      ) : !status?.connected ? (
        <section className="panel ads-connect">
          <h2 className="panel-title">{t("connectTitle")}</h2>
          <p className="section-sub">{t("connectBody")}</p>
          {status?.realOAuthAvailable ? (
            <a className="btn" href="/api/ads/oauth/start">
              {t("connectMeta")}
            </a>
          ) : (
            <p className="banner warn">{t("oauthUnavailable")}</p>
          )}
          <button
            type="button"
            className="btn secondary"
            disabled={busy}
            onClick={() => void connectMock()}
          >
            {t("useMock")}
          </button>
          {status?.setupHints?.length ? (
            <ul className="ads-hints">
              {status.setupHints.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          ) : null}
          {status?.redirectUri ? (
            <p className="ads-muted">
              {t("redirectUri")}: <code>{status.redirectUri}</code>
            </p>
          ) : null}
        </section>
      ) : (
        <>
          <section className="panel ads-toolbar">
            <div className="ads-toolbar-row">
              <label className="ads-field">
                <span>{t("account")}</span>
                <select
                  value={status.selectedAccount?.actId || ""}
                  disabled={busy}
                  onChange={(e) => void selectAccount(e.target.value)}
                >
                  {status.accounts.map((a) => (
                    <option key={a.actId} value={a.actId}>
                      {a.name} ({a.actId})
                    </option>
                  ))}
                </select>
              </label>
              <label className="ads-field">
                <span>{t("dateRange")}</span>
                <select
                  value={preset}
                  disabled={busy}
                  onChange={(e) => {
                    const p = e.target.value as DatePreset;
                    setPreset(p);
                    void loadHierarchy(p).catch((err) =>
                      setError(err instanceof Error ? err.message : t("loadError"))
                    );
                  }}
                >
                  <option value="today">{t("presetToday")}</option>
                  <option value="last_7d">{t("preset7d")}</option>
                  <option value="last_30d">{t("preset30d")}</option>
                </select>
              </label>
              <div className="ads-toolbar-actions">
                <button
                  type="button"
                  className="btn secondary"
                  disabled={busy}
                  onClick={() => void loadReport()}
                >
                  {t("dailyReport")}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  disabled={busy}
                  onClick={() => void disconnect()}
                >
                  {t("disconnect")}
                </button>
              </div>
            </div>
            {status.mock ? <p className="banner warn">{t("mockBanner")}</p> : null}
            <p className="ads-muted">
              {status.metaUserName} · {status.scopes}
              {hierarchy ? ` · ${hierarchy.since} → ${hierarchy.until}` : null}
            </p>
          </section>

          {totalsFmt && hierarchy ? (
            <section className="ads-totals">
              <MetricCell label={t("spend")} value={totalsFmt.spend} />
              <MetricCell label={t("impressions")} value={totalsFmt.impressions} />
              <MetricCell label={t("clicks")} value={totalsFmt.clicks} />
              <MetricCell label="CTR" value={totalsFmt.ctr} />
              <MetricCell label="CPC" value={totalsFmt.cpc} />
              <MetricCell label="CPA" value={totalsFmt.cpa} />
            </section>
          ) : null}

          <section className="panel">
            <h2 className="panel-title">{t("hierarchy")}</h2>
            {!hierarchy?.campaigns?.length ? (
              <p className="section-sub">{t("emptyHierarchy")}</p>
            ) : (
              <ul className="ads-camps">{hierarchy.campaigns.map(renderCampaign)}</ul>
            )}
          </section>

          {report ? (
            <section className="panel">
              <h2 className="panel-title">{t("dailyReport")}</h2>
              <pre className="ads-report">{report}</pre>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
