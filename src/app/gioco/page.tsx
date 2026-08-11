import type { Metadata } from "next";
import Link from "next/link";

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
  name: "Dall’inferno in su",
  alternateName: "Il gioco della risalita",
  description: siteConfig.gameDescription,
  url: absoluteUrl("/gioco"),
  image: absoluteUrl("/gioco/opengraph-image"),
  inLanguage: siteConfig.language,
  genre: ["Arcade", "Musicale"],
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
      <SiteHeader variant="light" />

      <main>
        <section className={styles.hero} aria-labelledby="game-page-title">
          <div className={styles.heroGrid} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>DDC / GHETTO SUPERSTAR / 001</p>
            <h1 id="game-page-title">
              Dall’inferno <em>in su.</em>
            </h1>
            <div className={styles.heroFooter}>
              <p>60 secondi. Una sola direzione.</p>
              <a href="#partita">Inizia la risalita ↓</a>
            </div>
          </div>
        </section>

        <section
          id="partita"
          className={styles.gameSection}
          aria-labelledby="rules-title"
        >
          <div className={styles.rules}>
            <p className={styles.sectionIndex}>01 / LA RISALITA</p>
            <h2 id="rules-title">Scendi. Respira. Risali.</h2>
            <p className={styles.rulesLead}>
              Non devi arrivare perfetto. Devi arrivare ancora vivo.
            </p>
            <ol>
              <li>
                <span>01</span>
                <p>
                  <strong>Sali</strong>
                  Tieni premuto sullo schermo. Da tastiera usa Spazio o Freccia
                  su.
                </p>
              </li>
              <li>
                <span>02</span>
                <p>
                  <strong>Respira</strong>
                  Rilascia il comando prima che il fiato finisca.
                </p>
              </li>
              <li>
                <span>03</span>
                <p>
                  <strong>Trova la voce</strong>
                  Evita il Rumore e raccogli i frammenti luminosi.
                </p>
              </li>
            </ol>
          </div>

          <div className={styles.gameWrap}>
            <RiseGame />
          </div>
        </section>

        <section className={styles.outro} aria-labelledby="outro-title">
          <p className={styles.sectionIndex}>02 / DOPO QUOTA ZERO</p>
          <h2 id="outro-title">Non è una fuga. È una risalita.</h2>
          <Link href="/">Torna al viaggio</Link>
        </section>
      </main>
    </div>
  );
}
