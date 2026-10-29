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
            Tu restaurante en miniatura. Gira, acerca y toca una zona para ver
            los pendientes ahí.
          </p>
          <p className="home-3d-hint">
            {openCount} pendientes abiertos · auto-gira en reposo · pellizca para
            zoom
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
