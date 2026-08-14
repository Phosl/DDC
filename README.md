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
- Verso da tastiera: `J` oppure `X`
- Joypad: stick sinistro per muoversi, `A/✕` per saltare, stick destro per
  mirare a 360°, `R2/RB` per lanciare Versi e `Start` per la pausa
- Pausa: `P` oppure `Esc`

Su schermi touch, movimento e salto restano pulsanti multi-touch; lo stick destro
virtuale mira a 360° e lancia Versi finché viene tenuto inclinato. Grafica,
personaggi e suoni sono originali; i riferimenti ai giochi arcade anni Novanta
riguardano esclusivamente ritmo e leggibilità dell’azione.
