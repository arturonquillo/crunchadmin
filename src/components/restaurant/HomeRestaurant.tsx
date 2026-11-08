"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { resolveZone, type RestaurantZone } from "@/lib/zones";
import { ZonePanel, type PanelPendiente } from "./ZonePanel";

function SceneLoading() {
  const t = useTranslations("Home3d");
  return (
    <div className="restaurant-canvas restaurant-loading">
      <p>{t("loading")}</p>
    </div>
  );
}

const RestaurantScene = dynamic(
  () =>
    import("./RestaurantScene").then((m) => m.RestaurantScene),
  {
    ssr: false,
    loading: () => <SceneLoading />,
  }
);

type Props = {
  pendientes: PanelPendiente[];
};

export function HomeRestaurant({ pendientes }: Props) {
  const t = useTranslations("Home3d");
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
          {/* Brand lives only in the sticky nav — no duplicate hero title */}
          <h1 className="sr-only">Crunchadmin</h1>
          <p>{t("lead")}</p>
          <p className="home-3d-hint">{t("hint", { count: openCount })}</p>
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
