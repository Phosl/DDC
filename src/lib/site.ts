export const SITE_ORIGIN = "https://ghetto-superstar-ddc.vercel.app";

export const siteConfig = {
  artistName: "Davide Del Carmen",
  artistAlternateName: "DDC",
  projectName: "Ghetto Superstar",
  title: "Davide Del Carmen — Ghetto Superstar",
  description:
    "Ghetto Superstar è il progetto musicale di Davide Del Carmen: una risalita tra musica, immagini e un’esperienza interattiva.",
  gameTitle: "Dall’inferno in su — Il gioco",
  gameDescription:
    "Attraversa Giudecca, Dite e Le Stelle in sessanta secondi: spezza il Rumore con i tuoi Versi, raccogli la Voce e supera quota zero.",
  socialImageAlt:
    "Ghetto Superstar, progetto musicale di Davide Del Carmen",
  gameSocialImageAlt:
    "Dall’inferno in su, il gioco della risalita di DDC",
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
