export type JourneyChapter = {
  index: string;
  kicker: string;
  title: string;
  body: string;
  image: string;
  alt: string;
  tone: "mono" | "magenta" | "cyan";
};

export type Track = {
  number: string;
  title: string;
  note?: string;
};

export const navigation = [
  { label: "Il viaggio", href: "/#viaggio" },
  { label: "Progetto", href: "/#progetto" },
  { label: "Gioco", href: "/gioco" },
] as const;

export const journeyChapters: JourneyChapter[] = [
  {
    index: "01",
    kicker: "Radici",
    title: "Da dove vieni continua a parlare.",
    body: "Una stanza, pochi strumenti e tutto quello che serve per trasformare il rumore in voce.",
    image: "/media/studio.jpeg",
    alt: "Home studio di Davide Del Carmen con tastiera MIDI e monitor audio",
    tone: "mono",
  },
  {
    index: "02",
    kicker: "Inferno",
    title: "Il rumore fuori. Quello dentro.",
    body: "La pressione non diventa scenografia: resta addosso, attraversa i pezzi e cambia forma.",
    image: "/media/portrait-neon.jpeg",
    alt: "Davide Del Carmen seduto in un ambiente illuminato di magenta e viola",
    tone: "magenta",
  },
  {
    index: "03",
    kicker: "Risalita",
    title: "Ancora vivo. Più in alto.",
    body: "Ghetto Superstar è il movimento dal fondo verso l’aria, senza cancellare il punto di partenza.",
    image: "/media/portrait-bw.jpeg",
    alt: "Primo piano in bianco e nero di Davide Del Carmen",
    tone: "cyan",
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

export const projectFacts = [
  { value: "16", label: "tracce" },
  { value: "27:43", label: "durata attuale" },
  { value: "01", label: "direzione: su" },
] as const;
