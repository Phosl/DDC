import Link from "next/link";

import { navigation } from "@/content/project";

import styles from "./site-header.module.css";

type SiteHeaderProps = {
  variant?: "dark" | "light";
};

export function SiteHeader({ variant = "dark" }: SiteHeaderProps) {
  return (
    <header className={`${styles.header} ${styles[variant]}`}>
      <Link className={styles.brand} href="/" aria-label="Davide Del Carmen, home">
        <span>DDC</span>
        <span className={styles.brandMeta}>Davide Del Carmen</span>
      </Link>

      <nav aria-label="Navigazione principale">
        <ul className={styles.navigation}>
          {navigation.map((item) => (
            <li key={item.href}>
              <Link href={item.href}>{item.label}</Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className={styles.status} aria-label="Progetto in lavorazione">
        <span aria-hidden="true" />
        WIP / 26
      </div>
    </header>
  );
}
