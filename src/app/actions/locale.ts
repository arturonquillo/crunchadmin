"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  defaultLocale,
  isLocale,
  LOCALE_COOKIE,
  type Locale,
} from "@/i18n/config";

export async function setLocale(nextLocale: string) {
  const locale: Locale = isLocale(nextLocale) ? nextLocale : defaultLocale;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
