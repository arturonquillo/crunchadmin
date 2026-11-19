import { createHmac, timingSafeEqual } from "crypto";
import { getOAuthStateSecret } from "@/lib/meta/config";

export function signOAuthState(nonce: string): string {
  const sig = createHmac("sha256", getOAuthStateSecret())
    .update(nonce)
    .digest("hex");
  return `${nonce}.${sig}`;
}

export function verifyOAuthState(state: string | null): boolean {
  if (!state || !state.includes(".")) return false;
  const [nonce, sig] = state.split(".");
  if (!nonce || !sig) return false;
  const expected = createHmac("sha256", getOAuthStateSecret())
    .update(nonce)
    .digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}
