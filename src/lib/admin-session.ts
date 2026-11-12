const encoder = new TextEncoder();
const COOKIE = "crunch_admin";
const PAYLOAD = "crunchadmin-v1";

/** Session lasts 7 days; re-login after password rotate or expiry. */
export const ADMIN_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

export const ADMIN_COOKIE = COOKIE;

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

export function adminPassword(): string | null {
  const value = process.env.ADMIN_PASSWORD?.trim();
  return value ? value : null;
}

export function adminAuthEnabled(): boolean {
  return adminPassword() != null;
}

/** Production must set ADMIN_PASSWORD — open panel is only for local/dev. */
export function adminMisconfiguredInProduction(
  nodeEnv: string | undefined = process.env.NODE_ENV,
  passwordConfigured: boolean = adminAuthEnabled()
): boolean {
  return nodeEnv === "production" && !passwordConfigured;
}

export async function sessionToken(password: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(PAYLOAD));
  return [...new Uint8Array(sig)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function expectedSessionToken(): Promise<string | null> {
  const password = adminPassword();
  if (!password) return null;
  return sessionToken(password);
}

/** Constant-time hex/string compare (Edge + Node safe). */
export function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

export async function readAdminSession(
  cookieValue: string | undefined | null
): Promise<{ authenticated: boolean; enabled: boolean }> {
  const enabled = adminAuthEnabled();
  if (!enabled) {
    return { authenticated: !isProductionRuntime(), enabled: false };
  }
  const expected = await expectedSessionToken();
  const ok = Boolean(expected && cookieValue && safeEqual(cookieValue, expected));
  return { authenticated: ok, enabled: true };
}

export function adminCookieOptions(maxAge = ADMIN_SESSION_MAX_AGE_SEC) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProductionRuntime(),
    path: "/",
    maxAge,
  };
}

export function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

function firstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

/** Origins this deployment considers first-party (proxy + public URL aware). */
export function trustedOrigins(req: {
  headers: { get(name: string): string | null };
  nextUrl?: { origin: string };
  url?: string;
}): string[] {
  const origins = new Set<string>();

  if (req.nextUrl?.origin) origins.add(req.nextUrl.origin);
  try {
    if (req.url) origins.add(new URL(req.url).origin);
  } catch {
    /* ignore */
  }

  const host =
    firstHeaderValue(req.headers.get("x-forwarded-host")) ||
    firstHeaderValue(req.headers.get("host"));
  const proto =
    firstHeaderValue(req.headers.get("x-forwarded-proto")) ||
    (isProductionRuntime() ? "https" : "http");
  if (host) origins.add(`${proto}://${host}`);

  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) {
    try {
      origins.add(new URL(site).origin);
    } catch {
      /* ignore */
    }
  }

  // Common local / loopback variants when operators hit :3010 directly.
  origins.add("http://127.0.0.1:3010");
  origins.add("http://localhost:3010");

  return [...origins];
}

/**
 * Optional CSRF: mutating requests must show a same-origin Origin or Referer.
 * SameSite=Lax already blocks most cross-site cookie sends; this is defense in depth.
 * Compares against forwarded Host/Proto and NEXT_PUBLIC_SITE_URL because Caddy
 * reverse-proxies to 127.0.0.1:3010 (nextUrl.origin alone is not enough).
 */
export function sameOriginMutation(req: {
  method: string;
  headers: { get(name: string): string | null };
  nextUrl?: { origin: string };
  url?: string;
}): boolean {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;

  const allowed = trustedOrigins(req);
  if (allowed.length === 0) return false;

  const origin = req.headers.get("origin");
  if (origin) {
    return allowed.includes(origin);
  }

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return allowed.includes(new URL(referer).origin);
    } catch {
      return false;
    }
  }

  // Non-browser clients (curl) without Origin/Referer — allow when session cookie present;
  // browsers always send Origin on fetch POST.
  return true;
}
