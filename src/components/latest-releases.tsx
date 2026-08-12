import Image from "next/image";

import type { PublicRelease } from "@/content/project";

import styles from "./latest-releases.module.css";

type LatestReleasesProps = {
  releases: readonly PublicRelease[];
  catalogUrl: string;
};

const releaseDateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function formatReleaseDate(date: string) {
  return releaseDateFormatter.format(new Date(`${date}T00:00:00Z`));
}

export function LatestReleases({ releases, catalogUrl }: LatestReleasesProps) {
  if (releases.length === 0) return null;

  return (
    <section
      className={styles.releases}
      aria-labelledby="latest-releases-title"
      data-reveal
    >
      <header className={styles.header}>
        <div>
          <p>Catalogo pubblico</p>
          <h3 id="latest-releases-title">Ultime uscite</h3>
        </div>
        <a
          className={styles.catalogAction}
          href={catalogUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Apri tutto il catalogo di Davide Del Carmen su Spotify, si apre in una nuova scheda"
        >
          Tutto su Spotify <span aria-hidden="true">↗</span>
        </a>
      </header>

      <ol className={styles.list}>
        {releases.map((release, index) => (
          <li key={release.spotifyUrl}>
            <a
              className={styles.release}
              href={release.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Ascolta ${release.title} su Spotify, si apre in una nuova scheda`}
            >
              <div className={styles.cover}>
                <Image
                  src={release.cover}
                  alt=""
                  width={640}
                  height={640}
                  sizes="(max-width: 900px) 7rem, (max-width: 1440px) 16vw, 14rem"
                />
                <span aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <div className={styles.copy}>
                <p>{release.releaseType}</p>
                <h4>{release.title}</h4>
                <div className={styles.meta}>
                  <time dateTime={release.releaseDate}>
                    {formatReleaseDate(release.releaseDate)}
                  </time>
                  <span aria-hidden="true">↗</span>
                </div>
              </div>
            </a>
          </li>
        ))}
      </ol>

      <p className={styles.note}>
        Ghetto Superstar è ancora in lavorazione. Qui trovi le pubblicazioni già
        disponibili.
      </p>
    </section>
  );
}
