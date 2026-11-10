const encoder = new TextEncoder();
const COOKIE = "crunch_admin";
const PAYLOAD = "crunchadmin-v1";

export const ADMIN_COOKIE = COOKIE;

export function adminPassword(): string | null {
  const value = process.env.ADMIN_PASSWORD?.trim();
  return value ? value : null;
}

export function adminAuthEnabled(): boolean {
  return adminPassword() != null;
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

export function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
