export type JourneyChapter = {
  index: string;
  kicker: string;
  title: string;
  body: string;
  image: string;
  alt: string;
};

export type Track = {
  number: string;
  title: string;
  note?: string;
};

export type PublicRelease = {
  title: string;
  releaseType: "Singolo" | "Album";
  releaseDate: string;
  spotifyUrl: string;
  cover: string;
  visualMode: "reaction" | "echo" | "fracture";
  visualLabel: string;
};

export const navigation = [
  { label: "Il viaggio", href: "/#viaggio" },
  { label: "Progetto", href: "/#progetto" },
  { label: "Gioco", href: "/gioco" },
  { label: "IG", href: "/ig" },
  { label: "Materiali", href: "/materiali" },
] as const;

export const journeyChapters: JourneyChapter[] = [
  {
    index: "01",
    kicker: "Il fondo",
    title: "Il cielo è lontano. Ma si vede.",
    body: "Una cella nel fondo del pozzo. Le ferite restano, la luce in alto indica da dove ricominciare.",
    image: "/media/materiali/post-01-attuale.webp",
    alt: "Davide nella cella del carcere infernale, sotto le gallerie illuminate dal fuoco",
  },
  {
    index: "02",
    kicker: "Inferno",
    title: "Il rumore fuori. Quello dentro.",
    body: "Tra gironi di pietra, catene e ponti sospesi, la voce trova un alleato. DDC × O.G. Eastbull.",
    image: "/media/materiali/post-02-featuring-v3.webp",
    alt: "Davide sul ponte del carcere infernale, con l’annuncio del featuring con O.G. Eastbull",
  },
  {
    index: "03",
    kicker: "Risalita",
    title: "Ancora vivo. Più in alto.",
    body: "Ghetto Superstar è il movimento dal fondo verso l’aria, senza cancellare il punto di partenza.",
    image: "/media/materiali/post-04-salto-v3.webp",
    alt: "Davide salta verso l’uscita, sopra il vuoto del carcere infernale",
  },
];

export const featuredTracks: Track[] = [
  { number: "01", title: "Ghetto Superstar", note: "Intro" },
  { number: "03", title: "Niente Storie Serie", note: "Premix" },
  { number: "06", title: "Dall’inferno in su", note: "feat. OG Eastbull" },
  { number: "09", title: "Ancora Vivo" },
  { number: "15", title: "Dopo di te" },
  { number: "17", title: "Pensami", note: "Outro" },
];

export const latestReleases: readonly PublicRelease[] = [
  {
    title: "Chimica",
    releaseType: "Singolo",
    releaseDate: "2026-06-09",
    spotifyUrl: "https://open.spotify.com/album/0JP6Q9iB3VnMfJ3wAnNPJw",
    cover: "/media/releases/chimica.webp",
    visualMode: "reaction",
    visualLabel: "Reazione",
  },
  {
    title: "Già da un po'",
    releaseType: "Singolo",
    releaseDate: "2025-12-10",
    spotifyUrl: "https://open.spotify.com/album/490lmNZDpRvvHECQP8B3vr",
    cover: "/media/releases/gia-da-un-po.webp",
    visualMode: "echo",
    visualLabel: "Persistenza",
  },
  {
    title: "A3 La Morte Può Attendere, Pt. 2",
    releaseType: "Album",
    releaseDate: "2023-12-12",
    spotifyUrl: "https://open.spotify.com/album/3TjItLVghP1DEMSAkyrVSK",
    cover: "/media/releases/a3-la-morte-puo-attendere-pt-2.webp",
    visualMode: "fracture",
    visualLabel: "Rinvio",
  },
];

export const projectFacts = [
  { value: "16", label: "tracce" },
  { value: "27:43", label: "durata attuale" },
  { value: "01", label: "direzione: su" },
] as const;
