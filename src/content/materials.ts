export const firstPostCaption = `Il cielo è lontano. Ma si vede.

La risalita comincia qui.
27 novembre. Nuovo singolo.

Entra nel gioco dal link in bio.

#DDC #GhettoSuperstar`;

export const campaignSchedule = [
  { date: "2026-11-17", day: "17 nov", format: "Post 01", title: "Il fondo", status: "Immagine e caption disponibili", href: "#primo-post" },
  { date: "2026-11-19", day: "19 nov", format: "Reel 01", title: "Ritrovare la forza", status: "Montaggio pronto · look da aggiornare", href: "#reel" },
  { date: "2026-11-20", day: "20 nov", format: "Post 02", title: "Il featuring", status: "Bozza · look da aggiornare", href: "#post-successivi" },
  { date: "2026-11-23", day: "23 nov", format: "Post 03", title: "La trasformazione", status: "Bozza · look da aggiornare", href: "#post-successivi" },
  { date: "2026-11-25", day: "25 nov", format: "Post 04", title: "Il salto / Fuori", status: "Due immagini · look da aggiornare", href: "#post-successivi" },
  { date: "2026-11-27", day: "27 nov", format: "Reel 02", title: "Il flashback", status: "Scaletta disponibile · video da montare", href: "#direzione" },
] as const;

export const nextPostImages = [
  { src: "/media/ig/02-featuring", title: "Il featuring", label: "Post 02 · 20 novembre", alt: "Prima bozza di Davide nel carcere-pozzo con annuncio DDC × O.G. Eastbull, 27 novembre." },
  { src: "/media/ig/03-trasformazione", title: "La trasformazione", label: "Post 03 · 23 novembre", alt: "Prima bozza della trasformazione di Davide in Ghetto Superstar nel carcere." },
  { src: "/media/ig/04-salto", title: "Il salto", label: "Post 04 · immagine 1", alt: "Davide compie il salto verso l’uscita del carcere-pozzo nella prima bozza del carosello." },
  { src: "/media/ig/05-fuori", title: "Finalmente fuori", label: "Post 04 · immagine 2", alt: "Davide all’esterno del carcere, nella seconda immagine del carosello." },
] as const;

export const previousImages = [
  { src: "/media/materiali/post-01-v7", title: "Volto frontale", label: "Versione 7" },
  { src: "/media/materiali/post-01-v6", title: "Prime reference del viso", label: "Versione 6" },
  { src: "/media/materiali/post-01-v5", title: "Il carcere infernale", label: "Versione 5" },
  { src: "/media/materiali/post-01-v4", title: "I segni del percorso", label: "Versione 4" },
  { src: "/media/materiali/post-01-v2", title: "Il look senza occhiali", label: "Versione 2" },
  { src: "/media/ig/01-cella", title: "La prima cella", label: "Prima direzione" },
  { src: "/media/materiali/studio-senza-testo", title: "Studio senza testo", label: "Prima direzione" },
] as const;

export const reelImages = [
  { src: "reel-allenamento", title: "Il piegamento", width: 941, height: 1672 },
  { src: "reel-rialzarsi", title: "Rialzarsi", width: 992, height: 1586 },
  { src: "reel-pronto", title: "Pronto al salto", width: 992, height: 1586 },
] as const;
