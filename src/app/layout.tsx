import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Davide Del Carmen — Ghetto Superstar",
    template: "%s — Davide Del Carmen",
  },
  description:
    "Ghetto Superstar è una risalita: musica, immagini e un’esperienza interattiva di Davide Del Carmen.",
  openGraph: {
    title: "Davide Del Carmen — Ghetto Superstar",
    description: "Non è una fuga. È una risalita.",
    type: "website",
    locale: "it_IT",
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#080808",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
