import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { AppNav } from "@/components/AppNav";
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

export const metadata: Metadata = {
  title: "Crunchadmin",
  description:
    "Centro operativo del restaurante: pendientes, recetas con escalado, menú y asistente.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${display.variable} ${body.variable} antialiased`}>
        <AppNav />
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
