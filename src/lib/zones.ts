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

/** Spread floor plan: +Z = entrada/exterior, -Z = cocina, -X = barra, +X = oficina/baño */
export const ZONES: Record<RestaurantZone, ZoneDef> = {
  pared_entrada: {
    id: "pared_entrada",
    label: "Pared de entrada",
    position: [0, 1.2, 4.35],
    lookAt: [0, 0.7, 3.6],
    camera: [0, 5.2, 11.5],
    color: "#ea580c",
    highlight: "wall",
  },
  salon: {
    id: "salon",
    label: "Salón",
    position: [0.4, 0.9, 0.8],
    lookAt: [0.2, 0.45, 0.5],
    camera: [7.5, 6.2, 7.5],
    color: "#f97316",
    highlight: "floor",
  },
  barra: {
    id: "barra",
    label: "Barra",
    position: [-3.8, 1.0, 0.4],
    lookAt: [-3.4, 0.65, 0.4],
    camera: [1.5, 5.0, 6.5],
    color: "#c2410c",
    highlight: "counter",
  },
  cocina: {
    id: "cocina",
    label: "Cocina",
    position: [0.2, 0.95, -4.0],
    lookAt: [0.1, 0.55, -3.4],
    camera: [5.5, 5.5, 1.2],
    color: "#ea580c",
    highlight: "floor",
  },
  bano: {
    id: "bano",
    label: "Baño",
    position: [4.4, 0.95, -2.6],
    lookAt: [3.9, 0.55, -2.2],
    camera: [8.5, 5.0, 1.5],
    color: "#0ea5e9",
    highlight: "floor",
  },
  exterior: {
    id: "exterior",
    label: "Exterior",
    position: [0.8, 0.55, 6.8],
    lookAt: [0.5, 0.35, 5.8],
    camera: [5.5, 5.0, 12.5],
    color: "#65a30d",
    highlight: "none",
  },
  oficina: {
    id: "oficina",
    label: "Oficina / general",
    position: [4.3, 1.05, 2.4],
    lookAt: [3.8, 0.65, 2.0],
    camera: [9.0, 5.5, 6.5],
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
