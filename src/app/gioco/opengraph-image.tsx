import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { SocialCard } from "@/components/social-card";
import { siteConfig } from "@/lib/site";

export const alt = siteConfig.gameSocialImageAlt;
export const size = siteConfig.socialImage;
export const contentType = "image/png";

export default async function GameOpenGraphImage() {
  const portrait = await readFile(join(process.cwd(), "public/media/materiali/post-01-instagram.jpg"));
  return new ImageResponse(
    <SocialCard
      accent="#d87a43"
      imageSrc={`data:image/jpeg;base64,${portrait.toString("base64")}`}
      eyebrow="Cantica Zero / IX → I"
      footer="Nove cerchi. Tre atti. Una direzione: su."
      title={["Dall’inferno", "in su."]}
    />,
    size,
  );
}
