import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { SocialCard } from "@/components/social-card";
import { siteConfig } from "@/lib/site";

export const alt = "Ghetto Superstar — Davide Del Carmen nel carcere infernale";
export const size = siteConfig.socialImage;
export const contentType = "image/png";

const portrait = await readFile(join(process.cwd(), "public/media/materiali/post-01-instagram.jpg"), "base64");

export default function OpenGraphImage() {
  return new ImageResponse(
    <SocialCard
      accent="#27e0d1"
      eyebrow="Ghetto Superstar"
      footer="Non è una fuga. È una risalita."
      title={["Ghetto", "Superstar"]}
      imageSrc={`data:image/jpeg;base64,${portrait}`}
    />,
    size,
  );
}
