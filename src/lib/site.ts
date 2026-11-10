import { prisma } from "@/lib/prisma";

export const SITE_FIELDS = [
  "name",
  "tagline",
  "description",
  "phone",
  "whatsapp",
  "email",
  "address",
  "hours",
  "instagram",
  "facebook",
  "tiktok",
  "mapsUrl",
  "announcement",
] as const;

export type SiteField = (typeof SITE_FIELDS)[number];

const LIMITS: Record<SiteField, number> = {
  name: 80,
  tagline: 160,
  description: 2000,
  phone: 40,
  whatsapp: 40,
  email: 120,
  address: 240,
  hours: 500,
  instagram: 200,
  facebook: 200,
  tiktok: 200,
  mapsUrl: 500,
  announcement: 280,
};

const FIELD_LABEL: Record<SiteField, string> = {
  name: "Nombre",
  tagline: "Bajada",
  description: "Descripción",
  phone: "Teléfono",
  whatsapp: "WhatsApp",
  email: "Email",
  address: "Dirección",
  hours: "Horario",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  mapsUrl: "Mapa",
  announcement: "Aviso",
};

export async function getSiteSettings() {
  return prisma.siteSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
}

export function sanitizeSitePatch(input: unknown): { data: Partial<Record<SiteField, string>>; error?: string } {
  if (!input || typeof input !== "object") {
    return { data: {}, error: "Datos inválidos" };
  }
  const source = input as Record<string, unknown>;
  const data: Partial<Record<SiteField, string>> = {};

  for (const field of SITE_FIELDS) {
    if (source[field] == null) continue;
    const value = String(source[field]).trim();
    if (value.length > LIMITS[field]) {
      return {
        data: {},
        error: `${FIELD_LABEL[field]} supera los ${LIMITS[field]} caracteres`,
      };
    }
    data[field] = value;
  }

  if (data.name !== undefined && data.name.length === 0) {
    return { data: {}, error: "El nombre del sitio es obligatorio" };
  }
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return { data: {}, error: "El email no es válido" };
  }
  if (data.mapsUrl && !/^https?:\/\//i.test(data.mapsUrl)) {
    return { data: {}, error: "El enlace del mapa tiene que empezar con http:// o https://" };
  }

  return { data };
}
