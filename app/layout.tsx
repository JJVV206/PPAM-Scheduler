import type { Metadata } from "next";

import { Providers } from "@/app/providers";
import { APP_NAME } from "@/lib/constants/app";

import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description:
    "Gestiona asignaciones semanales de predicación pública, confirmaciones y reemplazos.",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
