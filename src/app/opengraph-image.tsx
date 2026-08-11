import { ImageResponse } from "next/og";

import { SocialCard } from "@/components/social-card";
import { siteConfig } from "@/lib/site";

export const alt = siteConfig.socialImageAlt;
export const size = siteConfig.socialImage;
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <SocialCard
      accent="#27e0d1"
      eyebrow="Ghetto Superstar"
      footer="Non è una fuga. È una risalita."
      title={["Ghetto", "Superstar"]}
    />,
    size,
  );
}
