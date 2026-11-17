import Image from "next/image";

import { siteConfig } from "@/lib/site";

type GameKeyArtProps = {
  className: string;
  fetchPriority?: "high" | "low" | "auto";
  sizes?: string;
};

export function GameKeyArt({
  className,
  fetchPriority,
  sizes = "(max-width: 54rem) 100vw, 58vw",
}: GameKeyArtProps) {
  return (
    <Image
      src={siteConfig.gamePoster}
      width={1122}
      height={1402}
      sizes={sizes}
      fetchPriority={fetchPriority}
      loading={fetchPriority === "high" ? "eager" : "lazy"}
      className={className}
      alt=""
    />
  );
}
