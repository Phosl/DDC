# Cantica Zero 2.0 — asset sources

All raster assets in this directory were generated specifically for DDC with
OpenAI ImageGen on 2026-08-13 and then processed locally to remove a flat
chroma-key background. No sprites, interfaces, weapons, sounds or animation
frames from existing commercial games are embedded here.

## Identity references

- `public/media/portrait-full.jpeg`: Davide Del Carmen identity and outfit.
- `public/game/sprites/davide-run.webp`: previous DDC sprite used only as a
  silhouette reference.

## Final production files

- `sprites/davide-atlas.png`: original 6 × 4 character action atlas.
- `sprites/davide-atlas-v2.png`: revised 6 × 4 runtime atlas with distinct jump, landing, ground/air Verse, hit, defeat and respawn states.
- `enemies/enemies-atlas.png`: original 3 × 3 common-enemy atlas.
- `enemies/minotauro.png`: original six-pose boss strip.
- `enemies/pluto.png`: original six-pose boss strip.
- `enemies/caronte.png`: original six-pose boss strip.
- `tiles/platforms.png`: original 8 × 3 platform/prop atlas.

The corresponding chroma-key intermediates were retained outside the deployed
project after alpha and integration QA; only the production files above ship.

The creative direction is an original DDC interpretation of Dante's descent
and ascent with a broad 1990s arcade sensibility. It does not reproduce the
characters, HUD, vehicles, weapons, sounds or artwork of Metal Slug or any
other existing game.
