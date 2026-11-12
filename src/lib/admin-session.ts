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

/**
 * Optional CSRF: mutating requests must show a same-origin Origin or Referer.
 * SameSite=Lax already blocks most cross-site cookie sends; this is defense in depth.
 */
export function sameOriginMutation(req: {
  method: string;
  headers: { get(name: string): string | null };
  nextUrl?: { origin: string };
  url?: string;
}): boolean {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;

  const hostOrigin = (() => {
    if (req.nextUrl?.origin) return req.nextUrl.origin;
    try {
      return new URL(req.url || "").origin;
    } catch {
      return null;
    }
  })();
  if (!hostOrigin) return false;

  const origin = req.headers.get("origin");
  if (origin) {
    return origin === hostOrigin;
  }

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === hostOrigin;
    } catch {
      return false;
    }
  }

  // Non-browser clients (curl) without Origin/Referer — allow when session cookie present;
  // browsers always send Origin on cross-origin and usually on same-origin POST/fetch.
  return true;
}
