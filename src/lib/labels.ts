export type PendienteCategoria =
  | "MEJORAS_FISICAS"
  | "COMPRAS"
  | "PLANES_FUTUROS"
  | "INSUMOS"
  | "NUEVAS_RECETAS";

export type PendienteEstado = "PENDIENTE" | "EN_CURSO" | "HECHO";
export type Prioridad = "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
export type Plataforma = "FOODIE" | "TIENDA_PROPIA";

export const CATEGORIA_LABEL: Record<PendienteCategoria, string> = {
  MEJORAS_FISICAS: "Mejoras físicas",
  COMPRAS: "Compras",
  PLANES_FUTUROS: "Planes futuros",
  INSUMOS: "Insumos",
  NUEVAS_RECETAS: "Nuevas recetas",
};

export const ESTADO_LABEL: Record<PendienteEstado, string> = {
  PENDIENTE: "Pendiente",
  EN_CURSO: "En curso",
  HECHO: "Hecho",
};

export const PRIORIDAD_LABEL: Record<Prioridad, string> = {
  BAJA: "Baja",
  MEDIA: "Media",
  ALTA: "Alta",
  CRITICA: "Crítica",
};

export const PLATAFORMA_LABEL: Record<Plataforma, string> = {
  FOODIE: "Foodie",
  TIENDA_PROPIA: "Tienda propia",
};

export const CATEGORIAS = Object.keys(CATEGORIA_LABEL) as PendienteCategoria[];
export const ESTADOS = Object.keys(ESTADO_LABEL) as PendienteEstado[];
export const PRIORIDADES = Object.keys(PRIORIDAD_LABEL) as Prioridad[];
export const PLATAFORMAS = Object.keys(PLATAFORMA_LABEL) as Plataforma[];

export type InsumoCategoria =
  | "ACEITES"
  | "CARNES"
  | "LACTEOS"
  | "SECOS"
  | "ESPECIAS"
  | "FRESCOS"
  | "OTROS";

export const INSUMO_CATEGORIA_LABEL: Record<InsumoCategoria, string> = {
  ACEITES: "Aceites y grasas",
  CARNES: "Carnes y aves",
  LACTEOS: "Lácteos y huevos",
  SECOS: "Secos y abarrotes",
  ESPECIAS: "Especias y aromas",
  FRESCOS: "Frescos y verduras",
  OTROS: "Otros",
};

export const INSUMO_CATEGORIAS = Object.keys(
  INSUMO_CATEGORIA_LABEL
) as InsumoCategoria[];
