export const firstPostCaption = `Il cielo è lontano. Ma si vede.

La risalita comincia qui.
27 novembre. Nuovo singolo.

Entra nel gioco dal link in bio.

#DDC #GhettoSuperstar`;

export const campaignSchedule = [
  { date: "2026-11-17", day: "17 nov", format: "Post 01", title: "Il fondo", status: "Immagine e caption disponibili", href: "#primo-post" },
  { date: "2026-11-19", day: "19 nov", format: "Reel 01", title: "Ritrovare la forza", status: "Montaggio pronto · look da aggiornare", href: "#reel" },
  { date: "2026-11-20", day: "20 nov", format: "Post 02", title: "Il featuring", status: "Revisione 2 disponibile", href: "#post-successivi" },
  { date: "2026-11-23", day: "23 nov", format: "Post 03", title: "La trasformazione", status: "Revisione 2 disponibile", href: "#post-successivi" },
  { date: "2026-11-25", day: "25 nov", format: "Post 04", title: "Il salto / Fuori", status: "Due immagini · revisione 2", href: "#post-successivi" },
  { date: "2026-11-27", day: "27 nov", format: "Reel 02", title: "Il flashback", status: "Scaletta disponibile · video da montare", href: "#direzione" },
] as const;

export const nextPostImages = [
  { src: "/media/materiali/post-02-featuring-v2", title: "Il featuring", label: "Post 02 · 20 novembre · Rev. 2", instagram: "/media/materiali/post-02-featuring-v2-instagram.jpg", alt: "Davide nel carcere infernale con annuncio DDC × O.G. Eastbull, 27 novembre; volto e ambientazione aggiornati." },
  { src: "/media/materiali/post-03-trasformazione-v2", title: "La trasformazione", label: "Post 03 · 23 novembre · Rev. 2", instagram: "/media/materiali/post-03-trasformazione-v2-instagram.jpg", alt: "Davide si trasforma in Ghetto Superstar nel carcere infernale, con il volto aggiornato e i segni del percorso." },
  { src: "/media/materiali/post-04-salto-v2", title: "Il salto", label: "Post 04 · immagine 1 · Rev. 2", instagram: "/media/materiali/post-04-salto-v2-instagram.jpg", alt: "Davide compie il salto verso l’uscita del carcere infernale, sopra il vuoto dei gironi." },
  { src: "/media/materiali/post-04-fuori-v2", title: "Finalmente fuori", label: "Post 04 · immagine 2 · Rev. 2", instagram: "/media/materiali/post-04-fuori-v2-instagram.jpg", alt: "Davide finalmente fuori dal carcere infernale, con il volto aggiornato e i segni della risalita." },
] as const;

export const previousImages = [
  { src: "/media/materiali/post-01-v7", title: "Volto frontale", label: "Versione 7" },
  { src: "/media/materiali/post-01-v6", title: "Prime reference del viso", label: "Versione 6" },
  { src: "/media/materiali/post-01-v5", title: "Il carcere infernale", label: "Versione 5" },
  { src: "/media/materiali/post-01-v4", title: "I segni del percorso", label: "Versione 4" },
  { src: "/media/materiali/post-01-v2", title: "Il look senza occhiali", label: "Versione 2" },
  { src: "/media/ig/01-cella", title: "La prima cella", label: "Prima direzione" },
  { src: "/media/materiali/studio-senza-testo", title: "Studio senza testo", label: "Prima direzione" },
  { src: "/media/ig/02-featuring", title: "Il featuring", label: "Post 02 · Prima direzione", alt: "Prima bozza del featuring DDC × O.G. Eastbull, con il look precedente." },
  { src: "/media/ig/03-trasformazione", title: "La trasformazione", label: "Post 03 · Prima direzione", alt: "Prima bozza della trasformazione, con il look precedente di Davide." },
  { src: "/media/ig/04-salto", title: "Il salto", label: "Post 04 · Prima direzione", alt: "Prima bozza del salto dal carcere, con il look precedente." },
  { src: "/media/ig/05-fuori", title: "Finalmente fuori", label: "Post 04 · Prima direzione", alt: "Prima bozza di Davide fuori dal carcere, con il look precedente." },
] as const;

export const reelImages = [
  { src: "reel-allenamento", title: "Il piegamento", width: 941, height: 1672 },
  { src: "reel-rialzarsi", title: "Rialzarsi", width: 992, height: 1586 },
  { src: "reel-pronto", title: "Pronto al salto", width: 992, height: 1586 },
] as const;
