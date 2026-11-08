import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { AppChrome } from "@/components/AppChrome";
import { dbPathHint } from "@/lib/db-mode";
import { getDbMode } from "@/lib/prisma";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Meta");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const dbMode = await getDbMode();

  return (
    <html lang={locale}>
      <body className={`${display.variable} ${body.variable} antialiased`}>
        <NextIntlClientProvider messages={messages}>
          <AppChrome
            dbMode={dbMode}
            desarrolloFile={dbPathHint("desarrollo")}
            produccionFile={dbPathHint("produccion")}
          >
            {children}
          </AppChrome>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
