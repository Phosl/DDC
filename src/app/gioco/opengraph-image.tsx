import { ImageResponse } from "next/og";

import { SocialCard } from "@/components/social-card";
import { siteConfig } from "@/lib/site";

export const alt = siteConfig.gameSocialImageAlt;
export const size = siteConfig.socialImage;
export const contentType = "image/png";

export default function GameOpenGraphImage() {
  return new ImageResponse(
    <SocialCard
      accent="#ff2a78"
      eyebrow="Gioco / 60 secondi"
      footer="Evita il rumore. Trova la tua voce."
      title={["Dall’inferno", "in su."]}
    />,
    size,
  );
}
