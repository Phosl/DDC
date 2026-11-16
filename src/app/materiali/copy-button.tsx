"use client";

import { useState } from "react";

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [message, setMessage] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Caption copiata");
    } catch {
      setMessage("Seleziona il testo qui sopra oppure scarica il file TXT.");
    }
  }

  return (
    <div>
      <button className={className} type="button" onClick={copy}>Copia caption</button>
      <p role="status" aria-live="polite">{message}</p>
    </div>
  );
}
