export type PendienteCategoria =
  | "MEJORAS_FISICAS"
  | "COMPRAS"
  | "PLANES_FUTUROS"
  | "INSUMOS"
  | "NUEVAS_RECETAS";

export type PendienteEstado = "PENDIENTE" | "EN_CURSO" | "HECHO";
export type Prioridad = "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
export type Plataforma = "FOODIE" | "TIENDA_PROPIA";

/** Enum keys only — display copy lives in next-intl messages (Labels.*). */
export const CATEGORIAS = [
  "MEJORAS_FISICAS",
  "COMPRAS",
  "PLANES_FUTUROS",
  "INSUMOS",
  "NUEVAS_RECETAS",
] as const satisfies readonly PendienteCategoria[];

export const ESTADOS = [
  "PENDIENTE",
  "EN_CURSO",
  "HECHO",
] as const satisfies readonly PendienteEstado[];

export const PRIORIDADES = [
  "BAJA",
  "MEDIA",
  "ALTA",
  "CRITICA",
] as const satisfies readonly Prioridad[];

export const PLATAFORMAS = [
  "FOODIE",
  "TIENDA_PROPIA",
] as const satisfies readonly Plataforma[];
