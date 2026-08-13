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
      eyebrow="Cantica Zero / IX → I"
      footer="Nove cerchi. Tre atti. Una direzione: su."
      title={["Dall’inferno", "in su."]}
    />,
    size,
  );
}
