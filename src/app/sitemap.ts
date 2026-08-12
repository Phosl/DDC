import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site";

const LAST_UPDATED = new Date("2026-08-12T00:00:00+02:00");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: absoluteUrl(),
      lastModified: LAST_UPDATED,
      changeFrequency: "monthly",
      priority: 1,
      images: [
        absoluteUrl("/media/hero-editorial.jpeg"),
        absoluteUrl("/media/portrait-neon.jpeg"),
        absoluteUrl("/media/studio.jpeg"),
        absoluteUrl("/media/portrait-bw.jpeg"),
        absoluteUrl("/media/portrait-full.jpeg"),
        absoluteUrl("/media/releases/chimica.webp"),
        absoluteUrl("/media/releases/gia-da-un-po.webp"),
        absoluteUrl("/media/releases/a3-la-morte-puo-attendere-pt-2.webp"),
      ],
    },
    {
      url: absoluteUrl("/gioco"),
      lastModified: LAST_UPDATED,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
