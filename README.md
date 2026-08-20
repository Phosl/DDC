# DDC — Ghetto Superstar

Landing editoriale e platform-shooter verticale per il progetto musicale di Davide Del Carmen.

## Stack

- Next.js App Router
- TypeScript e React
- GSAP e ScrollTrigger
- Phaser 4 e Arcade Physics, caricati soltanto su `/gioco`
- Web Audio procedurale originale

## Sviluppo

```bash
npm install
npm run dev
```

Controlli disponibili:

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

I materiali di lavorazione in `doc/` e i collegamenti di ascolto privati non vengono pubblicati.

## Cantica Zero

La campagna risale nove cerchi in tre Atti, da Giudecca alle Stelle. Il gioco è
progettato in formato verticale e offre modalità Standard e Assistita con record
locali separati.

- Movimento: `A/D` oppure `←/→`
- Salto variabile: `W`, `↑` oppure `Spazio`
- Verso da tastiera: `J`
- Joypad: stick sinistro per muoversi, `A/✕` per saltare, stick destro per
  mirare a 360°, `R2/RB` per lanciare Versi e `Start` per la pausa
- Pausa: `P` oppure `Esc`

Su schermi touch, lo stick sinistro controlla il movimento, il pulsante dedicato
gestisce il salto e lo stick destro mira a 360° e lancia Versi finché viene tenuto
inclinato. Il nickname e le classifiche Standard/Assistita restano salvati soltanto
nel browser locale.

In sviluppo, `X` attiva il volo di verifica e `W/S` oppure `↑/↓` ne controllano
l’altezza. L’attivazione trasforma Davide con aura, corona e scie cromatiche nella
palette del sito; una run che usa questa modalità non è valida per record o classifica.
Grafica, personaggi e suoni sono originali; i riferimenti ai giochi arcade anni
Novanta riguardano esclusivamente ritmo e leggibilità dell’azione.
