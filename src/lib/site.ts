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
    "Sessanta secondi per superare quota zero. Evita il rumore, trova la tua voce e comincia la risalita.",
  socialImageAlt:
    "Ghetto Superstar, progetto musicale di Davide Del Carmen",
  gameSocialImageAlt:
    "Dall’inferno in su, il gioco della risalita di DDC",
  locale: "it_IT",
  language: "it-IT",
  socialImage: {
    width: 1200,
    height: 630,
  },
} as const;

export function absoluteUrl(path = "/") {
  return new URL(path, SITE_ORIGIN).toString();
}
