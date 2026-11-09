/** Desarrollo (demo SQLite) vs Producción (real restaurant SQLite). */

export const DB_MODE_COOKIE = "crunchadmin_db_mode";

export type DbMode = "desarrollo" | "produccion";

export function isDbMode(value: unknown): value is DbMode {
  return value === "desarrollo" || value === "produccion";
}

/** Default is Desarrollo so accidental writes never hit the empty prod DB. */
export const DEFAULT_DB_MODE: DbMode = "desarrollo";

/**
 * Resolve the Prisma SQLite URL for a mode.
 * Prefer explicit DATABASE_URL_DEMO / DATABASE_URL_PROD; fall back to
 * DATABASE_URL for desarrollo and a sibling prod.db next to it for producción.
 */
export function resolveDbUrl(mode: DbMode): string {
  if (mode === "desarrollo") {
    return (
      process.env.DATABASE_URL_DEMO ||
      process.env.DATABASE_URL ||
      "file:./dev.db"
    );
  }

  if (process.env.DATABASE_URL_PROD) {
    return process.env.DATABASE_URL_PROD;
  }

  const demo =
    process.env.DATABASE_URL_DEMO ||
    process.env.DATABASE_URL ||
    "file:./dev.db";

  // Derive prod path from demo when only one URL is configured (local MVP).
  if (demo.includes("demo.db")) {
    return demo.replace("demo.db", "prod.db");
  }
  if (demo.includes("dev.db")) {
    return demo.replace("dev.db", "prod.db");
  }
  if (demo.endsWith(".db")) {
    return demo.replace(/\.db$/, ".prod.db");
  }
  return "file:./prod.db";
}

/** Short path label for the drawer (never a full secret). */
export function dbPathHint(mode: DbMode): string {
  const url = resolveDbUrl(mode);
  const file = url.replace(/^file:/, "");
  const parts = file.split(/[/\\]/);
  return parts[parts.length - 1] || file;
}

/** Refuse seed when the active URL clearly points at production. */
export function isProductionDbUrl(url: string): boolean {
  const normalized = url.replace(/^file:/, "").replace(/\\/g, "/").toLowerCase();
  return (
    normalized.endsWith("/prod.db") ||
    normalized.endsWith("prod.db") ||
    normalized.includes("/prod.db?") ||
    Boolean(process.env.DATABASE_URL_PROD && url === process.env.DATABASE_URL_PROD)
  );
}
