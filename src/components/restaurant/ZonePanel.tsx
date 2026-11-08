"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  type PendienteCategoria,
  type PendienteEstado,
  type Prioridad,
} from "@/lib/labels";
import { type RestaurantZone } from "@/lib/zones";

export type PanelPendiente = {
  id: string;
  title: string;
  description: string | null;
  categoria: string;
  estado: string;
  prioridad: string;
  zone: string;
};

type Props = {
  zone: RestaurantZone | null;
  pendientes: PanelPendiente[];
  onClose: () => void;
};

export function ZonePanel({ zone, pendientes, onClose }: Props) {
  const t = useTranslations("Home3d");
  const tc = useTranslations("Common");
  const tl = useTranslations("Labels");
  const open = Boolean(zone);
  const zoneName = zone ? tl(`zone.${zone}`) : tc("dash");
  const list = zone
    ? pendientes.filter((p) => p.zone === zone && p.estado !== "HECHO")
    : [];

  return (
    <aside
      className={`zone-sheet ${open ? "open" : ""}`}
      aria-hidden={!open}
      aria-label={
        zone ? t("inZoneAria", { zone: zoneName }) : t("zoneAria")
      }
    >
      <div className="zone-sheet-handle" />
      <div className="zone-sheet-head">
        <div>
          <p className="zone-sheet-kicker">{t("zoneKicker")}</p>
          <h2>{zoneName}</h2>
        </div>
        <button type="button" className="btn secondary" onClick={onClose}>
          {tc("close")}
        </button>
      </div>

      {list.length === 0 ? (
        <p className="empty">{t("zoneEmpty")}</p>
      ) : (
        <ul className="zone-task-list">
          {list.map((p) => (
            <li key={p.id}>
              {/* User content — keep original language */}
              <strong>{p.title}</strong>
              {p.description && <p>{p.description}</p>}
              <div className="zone-task-meta">
                <span className="badge">
                  {tl(`categoria.${p.categoria as PendienteCategoria}`)}
                </span>
                <span
                  className={
                    p.prioridad === "CRITICA" || p.prioridad === "ALTA"
                      ? "badge danger"
                      : "badge"
                  }
                >
                  {tl(`prioridad.${p.prioridad as Prioridad}`)}
                </span>
                <span className="badge warn">
                  {tl(`estado.${p.estado as PendienteEstado}`)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="zone-sheet-foot">
        <Link className="btn" href={zone ? `/pendientes?zona=${zone}` : "/pendientes"}>
          {t("manageList")}
        </Link>
      </div>
    </aside>
  );
}
