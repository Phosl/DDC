import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { campaignSchedule, firstPostCaption, nextPostImages, previousImages, reelImages } from "@/content/materials";
import { CopyButton } from "./copy-button";
import styles from "./materiali.module.css";

export const metadata: Metadata = {
  title: "Materiali · Ghetto Superstar",
  description: "Immagini, reel, testi e calendario della campagna di Davide Del Carmen. Tutti i materiali in un posto.",
  alternates: { canonical: "/materiali" },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false, noimageindex: true } },
  openGraph: {
    title: "Ghetto Superstar · Materiali",
    description: "La campagna, le immagini e il kit del primo post.",
    url: "/materiali",
    images: [{ url: "/media/materiali/post-01-attuale.webp", width: 1122, height: 1402 }],
  },
  twitter: { card: "summary_large_image", images: ["/media/materiali/post-01-attuale.webp"] },
};

function PictureCard({ src, title, label, alt }: { src: string; title: string; label: string; alt?: string }) {
  return (
    <figure className={styles.card}>
      <a href={`${src}.png`} target="_blank" rel="noopener noreferrer" aria-label={`Apri ${title}`}>
        <Image src={`${src}.webp`} alt={alt ?? `${title}, versione precedente del primo post.`} width={1122} height={1402} unoptimized loading="lazy" />
      </a>
      <figcaption>
        <div><span className={styles.eyebrow}>{label}</span><h3>{title}</h3></div>
        <a href={`${src}.png`} download>PNG ↓</a>
      </figcaption>
    </figure>
  );
}

export default function MaterialsPage() {
  return (
    <>
      <a className="skip-link" href="#primo-post">Vai al primo post</a>
      <SiteHeader />
      <main className={styles.page}>
        <header className={styles.intro}>
          <p className={styles.eyebrow}>DDC / Ghetto Superstar · Campagna novembre 2026</p>
          <h1>Materiali<span>.</span></h1>
          <div className={styles.introBottom}>
            <p>La risalita, un’immagine alla volta.<br />Bozze, video e testi della campagna, raccolti qui.</p>
            <a className={styles.download} href="/media/materiali/campagna-materiali.zip" download>Scarica tutti i materiali <span>ZIP ↓</span></a>
          </div>
          <nav className={styles.index} aria-label="Sezioni materiali">
            <a href="#primo-post">Primo post</a><a href="#calendario">Calendario</a><a href="#post-successivi">Altri post</a><a href="#reel">Reel</a><a href="#archivio">Archivio</a>
          </nav>
        </header>

        <section id="primo-post" className={styles.first} aria-labelledby="first-title">
          <div className={styles.firstImage}>
            <a href="/media/materiali/post-01-attuale.png" target="_blank" rel="noopener noreferrer" aria-label="Apri il primo post, versione attuale">
              <Image src="/media/materiali/post-01-attuale.webp" alt="Davide senza occhiali, con lievi segni sul volto, seduto nella cella di un carcere infernale. Gironi, ponti e un fiume di fuoco alle spalle; una luce lontana in alto." width={1122} height={1402} unoptimized loading="eager" />
            </a>
            <p className={styles.note}>Ultima revisione · Versione 8 · Da rivedere prima della pubblicazione</p>
          </div>
          <div className={styles.firstInfo}>
            <p className={styles.eyebrow}>Post 01 / <time dateTime="2026-11-17">17 novembre 2026</time></p>
            <h2 id="first-title">Il fondo.<br />L’inizio della risalita.</h2>
            <p>Davide in cella, nel carcere-pozzo infernale. Il volto aggiornato, i segni della sua storia, la luce ancora lontana.</p>
            <div className={styles.actions}>
              <a className={styles.primary} href="/media/materiali/post-01-instagram.jpg" download>Scarica per Instagram ↓</a>
              <a className={styles.secondary} href="/media/materiali/post-01-attuale.png" download>PNG originale ↓</a>
            </div>
            <p className={styles.note}>JPG 1080 × 1350 · Verticale 4:5 · Immagine senza scritte</p>
            <div className={styles.caption}>
              <h3>Caption proposta</h3>
              <p className={styles.copy}>{firstPostCaption}</p>
              <div className={styles.copyActions}>
                <CopyButton className={styles.secondary} text={firstPostCaption} />
                <a href="/media/materiali/testi/primo-post-caption.txt" download>Scarica TXT ↓</a>
              </div>
            </div>
            <div className={styles.bio}>
              <span className={styles.eyebrow}>Destinazione dal link in bio</span>
              <Link href="/gioco?utm_source=instagram&utm_medium=social&utm_campaign=risalita&utm_content=post01#partita">Apri il gioco ↗</Link>
              <p className={styles.note}>Per il pubblico usa questo link al gioco. Questa pagina raccoglie anche bozze e anticipazioni.</p>
            </div>
          </div>
        </section>

        <section id="calendario" className={styles.section} aria-labelledby="calendar-title">
          <header className={styles.sectionHeading}><div><p className={styles.eyebrow}>04 post / 02 reel</p><h2 id="calendar-title">Da qui al 27.</h2></div><a href="/media/materiali/testi/piano-campagna.txt" download>Scarica il piano ↓</a></header>
          <p className={styles.note}>Primo post spostato al 17 novembre. Il resto è una proposta aggiornata: post, reel, post, post, post, reel.</p>
          <ol className={styles.schedule}>
            {campaignSchedule.map((item) => <li key={item.date}><a href={item.href}><time dateTime={item.date}>{item.day}</time><span className={styles.eyebrow}>{item.format}</span><strong>{item.title}</strong><span className={styles.note}>{item.status}</span><span aria-hidden="true">↗</span></a></li>)}
          </ol>
        </section>

        <section id="post-successivi" className={styles.section} aria-labelledby="posts-title">
          <header className={styles.sectionHeading}><div><p className={styles.eyebrow}>Il seguito della storia</p><h2 id="posts-title">Le prossime scene.</h2></div></header>
          <p className={styles.notice}>Queste sono le prime bozze. Volto, occhiali e ambientazione vanno allineati al primo post aggiornato prima di pubblicarle.</p>
          <div className={styles.grid}>{nextPostImages.map((picture) => <PictureCard key={picture.src} {...picture} />)}</div>
        </section>

        <section id="reel" className={styles.section} aria-labelledby="reel-title">
          <header className={styles.sectionHeading}><div><p className={styles.eyebrow}>Reel 01 / 18 secondi</p><h2 id="reel-title">Ritrovare la forza.</h2></div></header>
          <div className={styles.reelLayout}>
            <video className={styles.video} controls playsInline preload="none" poster="/media/materiali/reel-poster.jpg" width={1080} height={1920} aria-label="Bozza reel allenamento, 18 secondi con musica originale">
              <source src="/media/materiali/reel-allenamento-v1.mp4" type="video/mp4" />
              Il tuo browser non riproduce questo video. <a href="/media/materiali/reel-allenamento-v1.mp4">Scarica il reel</a>.
            </video>
            <div className={styles.reelInfo}>
              <p className={styles.notice}>Bozza di montaggio · Immagini con il vecchio look, da aggiornare.</p>
              <p>Quattro immagini montate sul brano originale: riprendere fiato, allenarsi, rialzarsi, guardare l’uscita. Leggero movimento dell’inquadratura.</p>
              <p className={styles.note}>MP4 · 1080 × 1920 · 9:16 · 18 secondi · Audio incluso</p>
              <a className={styles.primary} href="/media/materiali/reel-allenamento-v1.mp4" download>Scarica il reel ↓</a>
              <h3>I fotogrammi dell’allenamento</h3>
              <div className={styles.stills}>{reelImages.map((picture) => <figure key={picture.src}><a href={`/media/materiali/${picture.src}.png`} download><Image src={`/media/materiali/${picture.src}.webp`} alt={`Prima bozza: Davide, ${picture.title.toLowerCase()}, nella cella con il look precedente.`} width={picture.width} height={picture.height} unoptimized loading="lazy" /></a><figcaption>{picture.title} ↓</figcaption></figure>)}</div>
            </div>
          </div>
        </section>

        <section id="archivio" className={styles.section} aria-labelledby="archive-title">
          <header className={styles.sectionHeading}><div><p className={styles.eyebrow}>Per confronto</p><h2 id="archive-title">Le versioni precedenti.</h2></div></header>
          <details className={styles.archive}><summary>Apri l’archivio · 7 immagini <span aria-hidden="true">+</span></summary><p className={styles.note}>Le prove restano disponibili. La versione attuale per il primo post è quella in apertura.</p><div className={styles.grid}>{previousImages.map((picture) => <PictureCard key={picture.src} {...picture} />)}</div></details>
        </section>

        <section id="direzione" className={`${styles.section} ${styles.direction}`} aria-labelledby="direction-title">
          <div><p className={styles.eyebrow}>La regola comune</p><h2 id="direction-title">Un inferno.<br />Una via d’uscita.</h2><p>Un carcere scavato in una voragine: gironi di pietra, catene, ponti, fuoco dal fondo. Davide resta umano, con i suoi lineamenti, senza occhiali e con i segni del percorso. La luce in alto indica la risalita.</p></div>
          <div><h3>Reel finale · 27 novembre</h3><p>Si apre fuori dal carcere. Poi il flashback: cella, allenamento, featuring, trasformazione, salto. Si torna fuori con la canzone e l’invito all’ascolto.</p><p className={styles.note}>Scaletta pronta; video finale ancora da montare. Titolo ufficiale del singolo e link di ascolto da inserire quando confermati.</p><a className={styles.secondary} href="/media/materiali/testi/storyboard-reel-finale.txt" download>Scarica la scaletta ↓</a></div>
        </section>
        <footer className={styles.footer}><Link href="/">← Torna al sito</Link><Link href="/ig">Campagna IG ↗</Link><span>Aggiornato il 16 novembre 2026 · Bozze di lavoro</span></footer>
      </main>
    </>
  );
}
