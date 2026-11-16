import type { MetadataRoute } from "next";

import { absoluteUrl, siteConfig } from "@/lib/site";

const LAST_UPDATED = new Date("2026-08-14T00:00:00+02:00");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: absoluteUrl("/ig"),
      lastModified: new Date("2026-11-16T00:00:00+01:00"),
      changeFrequency: "monthly",
      priority: 0.6,
      images: [
        absoluteUrl("/media/materiali/post-01-attuale.webp"),
        ...["02-featuring", "03-trasformazione", "04-salto", "05-fuori"].map(
          (image) => absoluteUrl(`/media/ig/${image}.webp`),
        ),
      ],
    },
    {
      url: absoluteUrl(),
      lastModified: LAST_UPDATED,
      changeFrequency: "monthly",
      priority: 1,
      images: [
        absoluteUrl("/media/hero-editorial.jpeg"),
        absoluteUrl("/media/portrait-neon.jpeg"),
        absoluteUrl("/media/studio-professional.webp"),
        absoluteUrl("/media/portrait-bw.jpeg"),
        absoluteUrl("/media/portrait-full.jpeg"),
        absoluteUrl("/media/releases/chimica.webp"),
        absoluteUrl("/media/releases/gia-da-un-po.webp"),
        absoluteUrl("/media/releases/a3-la-morte-puo-attendere-pt-2.webp"),
        absoluteUrl(siteConfig.gameBanner),
        absoluteUrl(siteConfig.gamePoster),
      ],
    },
    {
      url: absoluteUrl("/gioco"),
      lastModified: LAST_UPDATED,
      changeFrequency: "monthly",
      priority: 0.8,
      images: [
        absoluteUrl(siteConfig.gameBanner),
        absoluteUrl(siteConfig.gamePoster),
      ],
    },
  ];
}
