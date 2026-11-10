/** Alphabet without ambiguous characters (0/O, 1/l). */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

const CODE_RE = /^[a-z0-9]{3,32}$/;

export const QR_TIME_ZONE = "America/Maceio";

export function generateQrCode(length = 6): string {
  const size = Math.min(32, Math.max(3, length));
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const byte of bytes) {
    code += ALPHABET[byte % ALPHABET.length];
  }
  return code;
}

export function normalizeQrCode(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidQrCode(code: string): boolean {
  return CODE_RE.test(code);
}

export function siteBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "https://lecrunch.com.br";
  return raw.replace(/\/+$/, "");
}

export function publicQrUrl(code: string): string {
  return `${siteBaseUrl()}/qr/${code}`;
}

export type DestinationResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Accepts a full URL or a host/path (`instagram.com/_lecrunch`).
 * Only http(s). Rejects links that point back at /qr/ on this site.
 */
export function normalizeDestination(input: string): DestinationResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: "El destino es obligatorio" };
  }
  if (trimmed.length > 2000) {
    return { ok: false, error: "El destino es demasiado largo" };
  }

  const withProto = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withProto);
  } catch {
    return {
      ok: false,
      error: "La URL de destino no es válida. Ejemplo: https://instagram.com/_lecrunch",
    };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "El destino tiene que ser una URL http o https" };
  }
  if (!url.hostname || (url.hostname !== "localhost" && !url.hostname.includes("."))) {
    return {
      ok: false,
      error: "La URL de destino no es válida. Ejemplo: https://instagram.com/_lecrunch",
    };
  }
  if (pointsAtOwnQr(url)) {
    return {
      ok: false,
      error: "El destino no puede ser otro código QR de este sitio",
    };
  }

  return { ok: true, url: url.toString() };
}

function pointsAtOwnQr(url: URL): boolean {
  let base: URL;
  try {
    base = new URL(siteBaseUrl());
  } catch {
    return false;
  }
  const sameHost = url.hostname.toLowerCase() === base.hostname.toLowerCase();
  return sameHost && url.pathname.startsWith("/qr/");
}

export function dayKey(date: Date, timeZone = QR_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function fillDailyCounts(
  stamps: Date[],
  days: number,
  now = new Date(),
  timeZone = QR_TIME_ZONE
): { day: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const stamp of stamps) {
    const key = dayKey(stamp, timeZone);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const out: { day: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const cursor = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = dayKey(cursor, timeZone);
    if (out.some((row) => row.day === key)) continue;
    out.push({ day: key, count: counts.get(key) ?? 0 });
  }
  return out;
}

export function describeAgent(ua: string | null | undefined): string {
  if (!ua) return "Desconocido";
  if (/instagram/i.test(ua)) return "Instagram";
  if (/whatsapp/i.test(ua)) return "WhatsApp";
  if (/fbav|facebook/i.test(ua)) return "Facebook";
  if (/iphone|ipad/i.test(ua)) return "iPhone / iPad";
  if (/android/i.test(ua)) return "Android";
  if (/edg\//i.test(ua)) return "Edge";
  if (/chrome|crios/i.test(ua)) return "Chrome";
  if (/safari/i.test(ua)) return "Safari";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  return "Otro";
}

export function formatWhen(iso: string | Date, timeZone = QR_TIME_ZONE): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("es", {
    timeZone,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDayLabel(day: string, timeZone = QR_TIME_ZONE): string {
  const [year, month, date] = day.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, date, 15, 0, 0));
  return new Intl.DateTimeFormat("es", {
    timeZone,
    day: "numeric",
    month: "short",
  }).format(utc);
}
