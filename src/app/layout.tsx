import type { Metadata, Viewport } from "next";
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

/*
 * Chat/ops UI: keep focus-zoom off on iOS. Absolute 16px on controls is primary;
 * maximumScale=1 is the reliable Safari backstop when 16px alone still zooms
 * (observed on lecrunch.com.br/chat). Pinch-zoom remains limited by design here.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

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
