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
  alternateName: "Cantica Zero — Il gioco della risalita",
  description: siteConfig.gameDescription,
  url: absoluteUrl("/gioco"),
  image: absoluteUrl("/gioco/opengraph-image"),
  inLanguage: siteConfig.language,
  genre: ["Arcade", "Musicale", "Pixel art"],
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
          <div className={styles.heroPortal} aria-hidden="true">
            <span />
            <span />
            <span />
            <b>00</b>
          </div>
          <div className={styles.heroGrid} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>DDC / CANTICA ZERO / ARCADE 001</p>
            <h1 id="game-page-title">
              Dall’inferno <em>in su.</em>
            </h1>
            <div className={styles.heroFooter}>
              <p>Tre Canti. Sessanta secondi. Una sola direzione.</p>
              <a href="#partita">Entra nella selva ↓</a>
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
            <h2 id="rules-title">Attraversa i tre Canti.</h2>
            <p className={styles.rulesLead}>
              Guida Davide dal ghiaccio di Giudecca, oltre le mura di Dite,
              fino all’aria aperta. Hai perso la via, non la voce.
            </p>
            <ol>
              <li>
                <span>01</span>
                <p>
                  <strong>Sali</strong>
                  Tieni premuto per salire e lanciare Versi. Da tastiera usa
                  Spazio o Freccia su.
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
                  <strong>Spezza il rumore</strong>
                  I Versi aprono la strada. Raccogli i frammenti Voce per
                  guadagnare quota.
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
