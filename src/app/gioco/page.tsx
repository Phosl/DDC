import type { Metadata } from "next";
import Link from "next/link";

import { GameKeyArt } from "@/components/game-key-art";
import { RiseGame } from "@/components/rise-game";
import { SiteHeader } from "@/components/site-header";
import { StructuredData } from "@/components/structured-data";
import { absoluteUrl, siteConfig } from "@/lib/site";

import styles from "./gioco.module.css";

export const metadata: Metadata = {
  title: siteConfig.gameTitle,
  description: siteConfig.gameDescription,
  alternates: {
    canonical: "/gioco",
  },
  openGraph: {
    title: `${siteConfig.gameTitle} — ${siteConfig.artistName}`,
    description: siteConfig.gameDescription,
    url: "/gioco",
    siteName: `${siteConfig.projectName} — ${siteConfig.artistName}`,
    type: "website",
    locale: siteConfig.locale,
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.gameTitle} — ${siteConfig.artistName}`,
    description: siteConfig.gameDescription,
    images: [
      {
        url: "/gioco/opengraph-image",
        alt: siteConfig.gameSocialImageAlt,
      },
    ],
  },
};

const gameStructuredData = {
  "@context": "https://schema.org",
  "@type": "VideoGame",
  "@id": absoluteUrl("/gioco#game"),
  name: "Cantica Zero — Dall’inferno in su",
  alternateName: "Il gioco della risalita di DDC",
  description: siteConfig.gameDescription,
  url: absoluteUrl("/gioco"),
  image: absoluteUrl(siteConfig.gamePoster),
  inLanguage: siteConfig.language,
  genre: ["Platform", "Action", "Arcade", "Pixel art"],
  gamePlatform: "Web browser",
  playMode: "SinglePlayer",
  isAccessibleForFree: true,
  author: {
    "@type": "Person",
    "@id": absoluteUrl("/#artist"),
    name: siteConfig.artistName,
  },
  isPartOf: {
    "@type": "CreativeWork",
    "@id": absoluteUrl("/#project"),
    name: siteConfig.projectName,
  },
};

export default function GamePage() {
  return (
    <div className={styles.page}>
      <StructuredData data={gameStructuredData} id="game-structured-data" />
      <SiteHeader />

      <main>
        <section className={styles.hero} aria-labelledby="game-page-title">
          <div className={styles.heroArtwork} aria-hidden="true">
            <GameKeyArt
              className={styles.heroArtworkImage}
              fetchPriority="high"
            />
            <div className={styles.heroArtworkWash} />
          </div>
          <div className={styles.heroEdition} aria-hidden="true">
            <span>DDC presenta</span>
            <span>Arcade verticale · IX → I</span>
          </div>
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>DDC / CANTICA ZERO / SALA 001</p>
            <h1 id="game-page-title">
              <span>Cantica</span>
              <em>Zero</em>
              <small>Dall’inferno in su.</small>
            </h1>
            <div className={styles.heroFooter}>
              <p>Nove cerchi. Tre atti. Una direzione: su.</p>
              <a href="#partita">Gioca ora ↓</a>
            </div>
          </div>
        </section>

        <section
          id="partita"
          className={styles.gameSection}
          aria-labelledby="rules-title"
        >
          <div className={styles.rules}>
            <p className={styles.sectionIndex}>01 / LE REGOLE DEL VIANDANTE</p>
            <h2 id="rules-title">Risali i nove cerchi.</h2>
            <p className={styles.rulesLead}>
              Guida Davide dal ghiaccio di Giudecca fino alle stelle. Corri,
              salta e attraversa tre Atti: hai perso la via, non la voce.
            </p>
            <ol>
              <li>
                <span>01</span>
                <p>
                  <strong>Muoviti e salta</strong>
                  Usa A/D o le frecce per correre. W, Freccia su o Spazio
                  controllano altezza e ritmo del salto.
                </p>
              </li>
              <li>
                <span>02</span>
                <p>
                  <strong>Lancia Versi</strong>
                  Usa J o X. Da fermo e in aria miri in alto; correndo, il
                  Verso sale in diagonale.
                </p>
              </li>
              <li>
                <span>03</span>
                <p>
                  <strong>Spezza il rumore</strong>
                  I Versi aprono la strada e consumano FIATO. Raccogli Voce,
                  Rima e Luce; tre vite ti separano dall’ultimo checkpoint.
                </p>
              </li>
            </ol>
          </div>

          <div className={styles.gameWrap}>
            <RiseGame />
          </div>
        </section>

        <section className={styles.outro} aria-labelledby="outro-title">
          <p className={styles.sectionIndex}>02 / FUORI DALLA SELVA</p>
          <h2 id="outro-title">E quindi uscimmo a riveder le stelle.</h2>
          <Link href="/">Torna al viaggio</Link>
        </section>
      </main>
    </div>
  );
}
