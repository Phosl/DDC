import { getImageProps } from "next/image";

import { siteConfig } from "@/lib/site";

type GameKeyArtProps = {
  className: string;
  fetchPriority?: "high" | "low" | "auto";
  sizes?: string;
};

export function GameKeyArt({
  className,
  fetchPriority,
  sizes = "100vw",
}: GameKeyArtProps) {
  const common = {
    alt: "",
    fetchPriority,
    sizes,
  } as const;

  const {
    props: { srcSet: desktop },
  } = getImageProps({
    ...common,
    src: siteConfig.gameBanner,
    width: 1672,
    height: 941,
  });

  const {
    props: { srcSet: mobile, ...imageProps },
  } = getImageProps({
    ...common,
    src: siteConfig.gamePoster,
    width: 1003,
    height: 1568,
  });

  return (
    <picture>
      <source media="(min-width: 56rem)" srcSet={desktop} />
      <source media="(max-width: 55.999rem)" srcSet={mobile} />
      <img {...imageProps} className={className} alt="" />
    </picture>
  );
}
