export const SITE_ORIGIN = "https://ghetto-superstar-ddc.vercel.app";

export const siteConfig = {
  artistName: "Davide Del Carmen",
  artistAlternateName: "DDC",
  projectName: "Ghetto Superstar",
  title: "Davide Del Carmen — Ghetto Superstar",
  description:
    "Ghetto Superstar è il progetto musicale di Davide Del Carmen: una risalita tra musica, immagini e un’esperienza interattiva.",
  gameTitle: "Cantica Zero — Dall’inferno in su",
  gameDescription:
    "Un platform-shooter verticale dal IX al I cerchio: corri, salta sulle pedane, spezza il Rumore con i Versi e raggiungi quota zero.",
  gamePoster: "/media/materiali/post-01-attuale.webp",
  socialImageAlt:
    "Ghetto Superstar, progetto musicale di Davide Del Carmen",
  gameSocialImageAlt:
    "Davide nel carcere infernale di Cantica Zero, il gioco della risalita",
  locale: "it_IT",
  language: "it-IT",
  artistProfiles: {
    spotify: "https://open.spotify.com/artist/1Il7gP9WOSvyHCsvZAzuJR",
  },
  socialImage: {
    width: 1200,
    height: 630,
  },
} as const;

export function absoluteUrl(path = "/") {
  return new URL(path, SITE_ORIGIN).toString();
}
