/** Restaurant zones for the interactive 3D home scene */

export type RestaurantZone =
  | "pared_entrada"
  | "cocina"
  | "salon"
  | "barra"
  | "exterior"
  | "bano"
  | "oficina";

export type Vec3 = [number, number, number];

export type ZoneDef = {
  id: RestaurantZone;
  label: string;
  /** World position of the hotspot / marker */
  position: Vec3;
  /** Camera look-at when focusing this zone */
  lookAt: Vec3;
  /** Camera position when focusing */
  camera: Vec3;
  /** Accent for markers / highlights */
  color: string;
  /** Highlight mesh kind for “work pending here” */
  highlight?: "wall" | "floor" | "counter" | "none";
};

export const ZONES: Record<RestaurantZone, ZoneDef> = {
  pared_entrada: {
    id: "pared_entrada",
    label: "Pared de entrada",
    position: [0, 1.4, 3.05],
    lookAt: [0, 1.2, 2.5],
    camera: [0, 2.2, 7.5],
    color: "#c45c26",
    highlight: "wall",
  },
  salon: {
    id: "salon",
    label: "Salón",
    position: [0, 0.9, 0.4],
    lookAt: [0, 0.6, 0],
    camera: [4.5, 3.2, 5.5],
    color: "#2f6b3a",
    highlight: "floor",
  },
  barra: {
    id: "barra",
    label: "Barra",
    position: [-2.2, 1.0, -0.2],
    lookAt: [-2.0, 0.8, -0.2],
    camera: [1.5, 2.8, 3.8],
    color: "#8b5a2b",
    highlight: "counter",
  },
  cocina: {
    id: "cocina",
    label: "Cocina",
    position: [0, 1.0, -2.6],
    lookAt: [0, 0.9, -2.4],
    camera: [3.2, 3.0, 1.2],
    color: "#c2410c",
    highlight: "floor",
  },
  bano: {
    id: "bano",
    label: "Baño",
    position: [2.6, 1.0, -1.8],
    lookAt: [2.4, 0.9, -1.6],
    camera: [5.5, 2.8, 1.5],
    color: "#0e7490",
    highlight: "floor",
  },
  exterior: {
    id: "exterior",
    label: "Exterior",
    position: [0, 0.6, 5.2],
    lookAt: [0, 0.4, 4.5],
    camera: [3.5, 2.8, 8.5],
    color: "#65a30d",
    highlight: "none",
  },
  oficina: {
    id: "oficina",
    label: "Oficina / general",
    position: [3.4, 1.6, 1.2],
    lookAt: [2.8, 1.2, 1.0],
    camera: [6.5, 3.5, 4.0],
    color: "#475569",
    highlight: "none",
  },
};

export const ZONE_IDS = Object.keys(ZONES) as RestaurantZone[];

export const ZONE_LABEL: Record<RestaurantZone, string> = Object.fromEntries(
  ZONE_IDS.map((id) => [id, ZONES[id].label])
) as Record<RestaurantZone, string>;

export function isRestaurantZone(value: string): value is RestaurantZone {
  return ZONE_IDS.includes(value as RestaurantZone);
}

export function resolveZone(value: string | null | undefined): RestaurantZone {
  if (value && isRestaurantZone(value)) return value;
  return "oficina";
}
