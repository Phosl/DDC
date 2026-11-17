import type { MetadataRoute } from "next";

import { absoluteUrl, siteConfig } from "@/lib/site";

const LAST_UPDATED = new Date("2026-11-17T00:00:00+01:00");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: absoluteUrl("/ig"),
      lastModified: new Date("2026-11-17T00:00:00+01:00"),
      changeFrequency: "monthly",
      priority: 0.6,
      images: [
        absoluteUrl("/media/materiali/post-01-attuale.webp"),
        ...["post-02-featuring-v3", "post-03-trasformazione-v3", "post-04-salto-v3", "post-04-fuori-v3"].map(
          (image) => absoluteUrl(`/media/materiali/${image}.webp`),
        ),
      ],
    },
    {
      url: absoluteUrl(),
      lastModified: LAST_UPDATED,
      changeFrequency: "monthly",
      priority: 1,
      images: [
        absoluteUrl("/media/materiali/post-01-attuale.webp"),
        absoluteUrl("/media/materiali/post-02-featuring-v3.webp"),
        absoluteUrl("/media/materiali/post-03-trasformazione-v3.webp"),
        absoluteUrl("/media/materiali/post-04-salto-v3.webp"),
        absoluteUrl("/media/materiali/post-04-fuori-v3.webp"),
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
      images: [
        absoluteUrl(siteConfig.gamePoster),
        absoluteUrl("/media/materiali/post-03-trasformazione-v3.webp"),
        absoluteUrl("/media/materiali/post-04-fuori-v3.webp"),
      ],
    },
  ];
}
