/** Restaurant zones for the interactive 3D home scene (open dollhouse layout) */

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
  position: Vec3;
  lookAt: Vec3;
  camera: Vec3;
  color: string;
  highlight?: "wall" | "floor" | "counter" | "none";
};

/** Layout: open-top dollhouse on a diorama base. +Z = entrada/exterior, -Z = cocina */
export const ZONES: Record<RestaurantZone, ZoneDef> = {
  pared_entrada: {
    id: "pared_entrada",
    label: "Pared de entrada",
    position: [0, 1.15, 2.55],
    lookAt: [0, 0.7, 2.0],
    camera: [0, 3.8, 7.2],
    color: "#ea580c",
    highlight: "wall",
  },
  salon: {
    id: "salon",
    label: "Salón",
    position: [0.35, 0.85, 0.35],
    lookAt: [0.2, 0.5, 0.2],
    camera: [4.8, 4.2, 4.8],
    color: "#f97316",
    highlight: "floor",
  },
  barra: {
    id: "barra",
    label: "Barra",
    position: [-2.15, 0.95, 0.1],
    lookAt: [-1.9, 0.7, 0.1],
    camera: [2.2, 3.6, 4.0],
    color: "#c2410c",
    highlight: "counter",
  },
  cocina: {
    id: "cocina",
    label: "Cocina",
    position: [0.2, 0.9, -2.35],
    lookAt: [0.1, 0.6, -2.0],
    camera: [3.5, 3.8, 1.5],
    color: "#ea580c",
    highlight: "floor",
  },
  bano: {
    id: "bano",
    label: "Baño",
    position: [2.45, 0.9, -1.85],
    lookAt: [2.2, 0.6, -1.5],
    camera: [5.5, 3.5, 1.2],
    color: "#0ea5e9",
    highlight: "floor",
  },
  exterior: {
    id: "exterior",
    label: "Exterior",
    position: [0.9, 0.55, 4.0],
    lookAt: [0.6, 0.35, 3.4],
    camera: [3.8, 3.4, 7.5],
    color: "#65a30d",
    highlight: "none",
  },
  oficina: {
    id: "oficina",
    label: "Oficina / general",
    position: [2.55, 1.05, 1.35],
    lookAt: [2.2, 0.7, 1.1],
    camera: [5.8, 3.8, 4.2],
    color: "#78716c",
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
