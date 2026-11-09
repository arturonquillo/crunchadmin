import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient } from "@prisma/client";
import { cookies } from "next/headers";
import {
  DB_MODE_COOKIE,
  DEFAULT_DB_MODE,
  isDbMode,
  resolveDbUrl,
  type DbMode,
} from "@/lib/db-mode";

const prismaAls = new AsyncLocalStorage<PrismaClient>();

const globalForPrisma = globalThis as unknown as {
  prismaDemo?: PrismaClient;
  prismaProd?: PrismaClient;
};

function makeClient(url: string): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function clientFor(mode: DbMode): PrismaClient {
  if (mode === "produccion") {
    if (!globalForPrisma.prismaProd) {
      globalForPrisma.prismaProd = makeClient(resolveDbUrl("produccion"));
    }
    return globalForPrisma.prismaProd;
  }
  if (!globalForPrisma.prismaDemo) {
    globalForPrisma.prismaDemo = makeClient(resolveDbUrl("desarrollo"));
  }
  return globalForPrisma.prismaDemo;
}

export async function getDbMode(): Promise<DbMode> {
  try {
    const store = await cookies();
    const raw = store.get(DB_MODE_COOKIE)?.value;
    if (isDbMode(raw)) return raw;
  } catch {
    /* cookies() unavailable outside a request (scripts / build) */
  }
  return DEFAULT_DB_MODE;
}

export async function getPrisma(): Promise<PrismaClient> {
  const scoped = prismaAls.getStore();
  if (scoped) return scoped;
  const mode = await getDbMode();
  return clientFor(mode);
}

/** Run a callback with request-scoped Prisma (for modules that import `prisma`). */
export async function runWithPrisma<T>(fn: () => Promise<T>): Promise<T> {
  const client = await getPrisma();
  return prismaAls.run(client, fn);
}

/**
 * Request-scoped proxy. Prefer `await getPrisma()` in new code.
 * Safe inside `runWithPrisma` / after the first `getPrisma` in the same ALS context.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = prismaAls.getStore() ?? clientFor(DEFAULT_DB_MODE);
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
