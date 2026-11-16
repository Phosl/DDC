import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { SiteHeader } from "@/components/site-header";

import styles from "./ig.module.css";

export const metadata: Metadata = {
  title: "IG · Ghetto Superstar",
  description: "Le immagini della campagna Ghetto Superstar: dal fondo del carcere-pozzo fino all’aria. Davide Del Carmen con O.G. Eastbull, 27 novembre 2026.",
  alternates: { canonical: "/ig" },
  openGraph: {
    title: "Ghetto Superstar · La campagna IG",
    description: "Quattro post, una risalita. DDC × O.G. Eastbull · 27 novembre 2026.",
    url: "/ig",
    images: [{ url: "/media/materiali/post-01-attuale.webp", width: 1122, height: 1402, alt: "Davide nel carcere infernale, Ghetto Superstar" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/media/materiali/post-01-attuale.webp"],
  },
};

const posts = [
  {
    number: "01",
    date: "2026-11-17",
    day: "17 novembre",
    title: "Il fondo",
    description: "Il cielo è lontano. Ma si vede.",
    images: [{ src: "/media/materiali/post-01-attuale", label: "La cella · versione attuale", alt: "Davide senza occhiali, seduto nella cella del carcere infernale, tra gironi di pietra e una luce lontana in alto." }],
  },
  {
    number: "02",
    date: "2026-11-20",
    day: "20 novembre",
    title: "L’incontro",
    description: "DDC × O.G. Eastbull. Il featuring, dentro la storia.",
    images: [{ src: "/media/ig/02-featuring", label: "Il featuring", alt: "Davide su una galleria del carcere-pozzo. Annuncio DDC × O.G. Eastbull, 27 novembre." }],
  },
  {
    number: "03",
    date: "2026-11-23",
    day: "23 novembre",
    title: "La trasformazione",
    description: "Le origini restano. Cambia lo sguardo.",
    images: [{ src: "/media/ig/03-trasformazione", label: "Ghetto Superstar", alt: "Davide in piedi, deciso e illuminato dall’alto, nel carcere-pozzo. Ghetto Superstar, 27 novembre." }],
  },
  {
    number: "04",
    date: "2026-11-25",
    day: "25 novembre",
    title: "Il salto",
    description: "Il salto non cancella il fondo. Ti porta fuori.",
    images: [
      { src: "/media/ig/04-salto", label: "1 / 2 · Il salto", alt: "Davide salta dall’ultimo cornicione verso la porta aperta del carcere-pozzo, con il vuoto sotto di lui." },
      { src: "/media/ig/05-fuori", label: "2 / 2 · Finalmente fuori", alt: "Davide finalmente all’aperto, con il carcere-pozzo alle spalle e il cielo luminoso davanti." },
    ],
  },
];

export default function InstagramPage() {
  return (
    <>
      <a className="skip-link" href="#post">Vai alle immagini</a>
      <SiteHeader />
      <main className={styles.page} id="contenuto">
        <header className={styles.intro}>
          <p className={styles.eyebrow}>IG / Novembre 2026 · Bozze della campagna</p>
          <h1>Dal fondo.<br /><span>Fino all’aria.</span></h1>
          <div className={styles.introBottom}>
            <p>Ghetto Superstar in quattro post. La cella, l’incontro, la trasformazione e l’uscita.</p>
            <p className={styles.release}>DDC × O.G. Eastbull<br /><strong>27 novembre 2026</strong></p>
          </div>
          <p className={styles.hint}>Calendario previsto · Apri un’immagine per vederla intera.</p>
          <p><Link href="/materiali">Materiali, reel, caption e file per Instagram →</Link></p>
        </header>

        <div id="post" className={styles.posts}>
          {posts.map((post, postIndex) => (
            <article className={styles.post} key={post.number} aria-labelledby={`post-${post.number}`}>
              <header className={styles.postHeading}>
                <p className={styles.eyebrow}>Post {post.number} <span>／</span> <time dateTime={post.date}>{post.day}</time></p>
                <h2 id={`post-${post.number}`}>{post.title}</h2>
                <p>{post.description}</p>
                <p className={styles.hint}>{postIndex === 0 ? "Ultima revisione · Da rivedere prima della pubblicazione" : "Prima bozza · Volto e ambientazione da aggiornare"}</p>
                {post.images.length > 1 && <p className={styles.hint}>Carosello · 2 immagini</p>}
              </header>
              <div className={styles.images}>
                {post.images.map((picture) => (
                  <figure className={styles.figure} key={picture.src}>
                    <a className={styles.imageLink} href={`${picture.src}.webp`} target="_blank" rel="noopener noreferrer" aria-label={`Apri ${picture.label}, immagine intera in una nuova scheda`}>
                      <Image src={`${picture.src}.webp`} alt={picture.alt} width={1122} height={1402} unoptimized loading={postIndex === 0 ? "eager" : "lazy"} className={styles.image} />
                    </a>
                    <figcaption><span>{picture.label}</span><a href={`${picture.src}.png`} download>Scarica PNG <span aria-hidden="true">↓</span></a></figcaption>
                  </figure>
                ))}
              </div>
            </article>
          ))}
        </div>

        <footer className={styles.footer}>
          <Link href="/">← Ghetto Superstar</Link>
          <Link href="/gioco#partita">Entra nel gioco ↗</Link>
        </footer>
      </main>
    </>
  );
}
