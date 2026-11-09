"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  DB_MODE_COOKIE,
  DEFAULT_DB_MODE,
  isDbMode,
  type DbMode,
} from "@/lib/db-mode";

export async function setDbMode(next: string): Promise<DbMode> {
  const mode: DbMode = isDbMode(next) ? next : DEFAULT_DB_MODE;
  const store = await cookies();
  store.set(DB_MODE_COOKIE, mode, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
  return mode;
}
