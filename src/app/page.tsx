import Image from "next/image";
import Link from "next/link";

import { HomeMotion } from "@/components/home-motion";
import { SiteHeader } from "@/components/site-header";
import { featuredTracks, journeyChapters, projectFacts } from "@/content/project";

import styles from "./home.module.css";

export default function HomePage() {
  return (
    <main className={styles.page} data-home id="contenuto">
      <a className="skip-link" href="#viaggio">
        Vai al contenuto
      </a>
      <HomeMotion />

      <section className={styles.hero} data-hero aria-labelledby="hero-title">
        <SiteHeader />

        <div className={styles.heroMedia} data-hero-image>
          <Image
            src="/media/hero-editorial.jpeg"
            alt="Ritratto editoriale di Davide Del Carmen"
            fill
            priority
            sizes="100vw"
            className={styles.heroImage}
          />
        </div>
        <div className={styles.heroShade} aria-hidden="true" />

        <div className={styles.heroOrbit} aria-hidden="true">
          <span data-orbit="outer" />
          <span />
          <span />
        </div>

        <div className={styles.heroContent}>
          <p className={styles.eyebrow} data-hero-meta>
            Davide Del Carmen <span>／</span> Nuovo progetto
          </p>

          <h1 className={styles.heroTitle} id="hero-title" aria-label="Ghetto Superstar">
            <span className={styles.titleMask}>
              <span data-hero-line>Ghetto</span>
            </span>
            <span className={`${styles.titleMask} ${styles.titleOffset}`}>
              <span data-hero-line>Superstar</span>
            </span>
          </h1>

          <div className={styles.heroBottom} data-hero-meta>
            <p>Non è una fuga. È una risalita.</p>
            <div className={styles.heroActions}>
              <a className={styles.primaryAction} href="#progetto">
                Scopri il progetto
                <span aria-hidden="true">↓</span>
              </a>
              <Link className={styles.textAction} href="/gioco">
                Inizia la risalita ↗
              </Link>
            </div>
          </div>
        </div>

        <div className={styles.altimeter} aria-hidden="true">
          <span>+000</span>
          <span className={styles.altimeterTrack}>
            <span data-progress-line />
          </span>
          <span>−900</span>
        </div>
      </section>

      <section className={styles.manifesto} data-manifesto aria-label="Manifesto">
        <div className={styles.manifestoOrbit} aria-hidden="true">
          <span data-orbit="outer" />
          <span />
          <span />
        </div>
        <p className={styles.sectionLabel} data-reveal>
          00 / Manifesto
        </p>
        <p className={styles.manifestoCopy} data-reveal>
          Il quartiere non resta indietro.
          <span>Sale con te.</span>
        </p>
        <p className={styles.manifestoNote} data-reveal>
          Dal fondo fino all’aria, senza cancellare il punto di partenza.
        </p>
      </section>

      <section className={styles.journey} id="viaggio" aria-labelledby="journey-title">
        <header className={styles.sectionHeader}>
          <p className={styles.sectionLabel} data-reveal>
            01 / Il viaggio
          </p>
          <h2 id="journey-title" data-reveal>
            Tre atti.
            <br />Una direzione.
          </h2>
        </header>

        <div className={styles.chapterList}>
          {journeyChapters.map((chapter) => (
            <article
              className={`${styles.chapter} ${styles[`chapter_${chapter.tone}`]}`}
              key={chapter.index}
            >
              <div className={styles.chapterImageWrap} data-chapter-image>
                <Image
                  src={chapter.image}
                  alt={chapter.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, 48vw"
                  className={styles.chapterImage}
                />
              </div>
              <div className={styles.chapterCopy} data-reveal>
                <p className={styles.chapterIndex}>{chapter.index}</p>
                <p className={styles.chapterKicker}>{chapter.kicker}</p>
                <h3>{chapter.title}</h3>
                <p className={styles.chapterBody}>{chapter.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.project} id="progetto" aria-labelledby="project-title">
        <header className={styles.projectHeading}>
          <div>
            <p className={styles.sectionLabel} data-reveal>
              02 / Il progetto
            </p>
            <p className={styles.workLabel} data-reveal>
              Sequenza in lavorazione
            </p>
          </div>
          <h2 id="project-title" data-reveal>
            Ghetto
            <br />Superstar
          </h2>
        </header>

        <div className={styles.projectGrid}>
          <div className={styles.projectPortrait} data-chapter-image>
            <Image
              src="/media/portrait-full.jpeg"
              alt="Davide Del Carmen in abbigliamento nero su fondo grigio"
              fill
              sizes="(max-width: 768px) 100vw, 38vw"
              className={styles.projectImage}
            />
            <span aria-hidden="true">DDC / 26</span>
          </div>

          <div className={styles.trackPanel}>
            <p className={styles.trackIntro} data-reveal>
              Un viaggio in 16 tracce. Qui una selezione della traiettoria attuale.
            </p>
            <ol className={styles.trackList}>
              {featuredTracks.map((track) => (
                <li key={`${track.number}-${track.title}`} data-reveal>
                  <span>{track.number}</span>
                  <strong>{track.title}</strong>
                  <small>{track.note ?? ""}</small>
                </li>
              ))}
            </ol>
            <p className={styles.privateNote} data-reveal>
              Ascolto pubblico in arrivo. La playlist privata non viene esposta dal sito.
            </p>
          </div>
        </div>

        <dl className={styles.facts}>
          {projectFacts.map((fact) => (
            <div key={fact.label} data-reveal>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.gameTeaser} aria-labelledby="game-title">
        <div className={styles.gameScene} aria-hidden="true">
          <div className={styles.gameSun} />
          <div className={styles.gameHouse}>
            <span />
            <span />
            <span />
          </div>
          <div className={styles.gameRoad} />
        </div>
        <div className={styles.gameCopy}>
          <p className={styles.sectionLabel} data-reveal>
            03 / Esperienza interattiva
          </p>
          <h2 id="game-title" data-reveal>
            Dall’inferno
            <br />in su.
          </h2>
          <div className={styles.gameMeta} data-reveal>
            <p>60 secondi. Una sola direzione.</p>
            <Link href="/gioco" className={styles.gameAction}>
              Gioca ora <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerPortrait}>
          <Image
            src="/media/portrait-bw.jpeg"
            alt="Davide Del Carmen"
            fill
            sizes="(max-width: 768px) 100vw, 42vw"
            className={styles.footerImage}
          />
        </div>
        <div className={styles.footerCopy}>
          <p className={styles.sectionLabel}>Davide Del Carmen</p>
          <p className={styles.footerStatement}>La voce resta. La quota cambia.</p>
          <div className={styles.footerBottom}>
            <span>© 2026 DDC</span>
            <a href="#contenuto">Torna su ↑</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
