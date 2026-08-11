import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { SITE_ORIGIN, siteConfig } from "@/lib/site";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  applicationName: siteConfig.projectName,
  title: {
    default: siteConfig.title,
    template: `%s — ${siteConfig.artistName}`,
  },
  description: siteConfig.description,
  authors: [{ name: siteConfig.artistName, url: "/" }],
  creator: siteConfig.artistName,
  publisher: siteConfig.artistName,
  category: "music",
  alternates: {
    canonical: "/",
  },
  formatDetection: {
    address: false,
    email: false,
    telephone: false,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: siteConfig.title,
    description: siteConfig.description,
    url: "/",
    siteName: `${siteConfig.projectName} — ${siteConfig.artistName}`,
    type: "website",
    locale: siteConfig.locale,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
    images: [
      {
        url: "/opengraph-image",
        alt: siteConfig.socialImageAlt,
      },
    ],
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
