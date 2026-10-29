"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { resolveZone, type RestaurantZone } from "@/lib/zones";
import { ZonePanel, type PanelPendiente } from "./ZonePanel";

const RestaurantScene = dynamic(
  () =>
    import("./RestaurantScene").then((m) => m.RestaurantScene),
  {
    ssr: false,
    loading: () => (
      <div className="restaurant-canvas restaurant-loading">
        <p>Cargando el local en 3D…</p>
      </div>
    ),
  }
);

type Props = {
  pendientes: PanelPendiente[];
};

export function HomeRestaurant({ pendientes }: Props) {
  const [focusedZone, setFocusedZone] = useState<RestaurantZone | null>(null);

  const normalized = useMemo(
    () =>
      pendientes.map((p) => ({
        ...p,
        zone: resolveZone(p.zone),
      })),
    [pendientes]
  );

  const openCount = normalized.filter((p) => p.estado !== "HECHO").length;

  return (
    <div className="home-3d">
      <div className="home-3d-overlay">
        <div className="home-3d-brand">
          <h1>Crunchadmin</h1>
          <p>
            Diorama abierto del local: sin techo, paredes que se apartan al girar
            para mirar siempre hacia adentro.
          </p>
          <p className="home-3d-hint">
            {openCount} pendientes abiertos · auto-gira · pellizca para zoom ·
            toca una zona
          </p>
        </div>
      </div>

      <RestaurantScene
        pendientes={normalized}
        focusedZone={focusedZone}
        onFocusZone={setFocusedZone}
      />

      <ZonePanel
        zone={focusedZone}
        pendientes={normalized}
        onClose={() => setFocusedZone(null)}
      />
    </div>
  );
}
