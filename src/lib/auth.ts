/**
 * Auth-ready stub.
 *
 * MVP runs as a single operator without login. Wire Clerk / NextAuth / Supabase Auth
 * here and gate API routes + UI with `getCurrentUser()`.
 *
 * Env vars (when enabling auth):
 * - NEXTAUTH_SECRET / NEXTAUTH_URL  (NextAuth)
 * - or CLERK_SECRET_KEY / NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
 * - or NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
};

/** Returns null until auth is configured — callers treat MVP as open single-user. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  return null;
}

export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.NEXTAUTH_SECRET ||
      process.env.CLERK_SECRET_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_URL
  );
}
