"use client";

import Link from "next/link";
import {
  CATEGORIA_LABEL,
  ESTADO_LABEL,
  PRIORIDAD_LABEL,
  type PendienteCategoria,
  type PendienteEstado,
  type Prioridad,
} from "@/lib/labels";
import { ZONE_LABEL, type RestaurantZone } from "@/lib/zones";

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
  const open = Boolean(zone);
  const list = zone
    ? pendientes.filter((p) => p.zone === zone && p.estado !== "HECHO")
    : [];

  return (
    <aside
      className={`zone-sheet ${open ? "open" : ""}`}
      aria-hidden={!open}
      aria-label={zone ? `Pendientes en ${ZONE_LABEL[zone]}` : "Zona"}
    >
      <div className="zone-sheet-handle" />
      <div className="zone-sheet-head">
        <div>
          <p className="zone-sheet-kicker">Zona</p>
          <h2>{zone ? ZONE_LABEL[zone] : "—"}</h2>
        </div>
        <button type="button" className="btn secondary" onClick={onClose}>
          Cerrar
        </button>
      </div>

      {list.length === 0 ? (
        <p className="empty">No hay pendientes abiertos en esta zona.</p>
      ) : (
        <ul className="zone-task-list">
          {list.map((p) => (
            <li key={p.id}>
              <strong>{p.title}</strong>
              {p.description && <p>{p.description}</p>}
              <div className="zone-task-meta">
                <span className="badge">
                  {CATEGORIA_LABEL[p.categoria as PendienteCategoria] ?? p.categoria}
                </span>
                <span
                  className={
                    p.prioridad === "CRITICA" || p.prioridad === "ALTA"
                      ? "badge danger"
                      : "badge"
                  }
                >
                  {PRIORIDAD_LABEL[p.prioridad as Prioridad] ?? p.prioridad}
                </span>
                <span className="badge warn">
                  {ESTADO_LABEL[p.estado as PendienteEstado] ?? p.estado}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="zone-sheet-foot">
        <Link className="btn" href={zone ? `/pendientes?zona=${zone}` : "/pendientes"}>
          Gestionar en lista
        </Link>
      </div>
    </aside>
  );
}
