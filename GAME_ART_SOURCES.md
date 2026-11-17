# Cantica Zero — art sources

The production assets in `public/game/` are original pixel-art generations made for DDC. Historical images were used only to study Dante's spatial language, scale, and progression; no scan or existing game asset is embedded in the final files.

## Iconographic research

- [Lucifer Appearing to Dante and Virgil in Hell — Cooper Hewitt / Smithsonian](https://www.si.edu/object/chndm_1901-39-2645) — public domain / Smithsonian Open Access. Reference for Cocytus, radial ice, and monumental scale.
- [Inferno, after the Fresco in the Camposanto of Pisa — Princeton University Art Museum](https://artmuseum.princeton.edu/art/collections/objects/48120) — public domain. Reference for layered chambers and the overall vertical topology.
- [The Vision of Hell — The Metropolitan Museum of Art](https://www.metmuseum.org/art/collection/search/338114) — public domain. Reference for Doré's engraved contrast and atmospheric depth.
- [Botticelli's illustrated Inferno manuscript — Vatican Library](https://digi.vatlib.it/view/MSS_Reg.lat.1896.pt.A/0005?ling=it) — visual research only; no Vatican scan reused.
- [The Divine Comedy — Library of Congress](https://www.loc.gov/item/2021667870/) — manuscript research; the Library is unaware of copyright restrictions in the collection item.
- [The Vision of Hell, illustrated by Gustave Doré — Project Gutenberg](https://www.gutenberg.org/cache/epub/8795/pg8795-images.html) — public-domain edition, used for the exit toward the stars and Purgatory palette cues.

Dite and Phlegethon are treated as consecutive places, not synonyms: the fortified city belongs to Inferno VIII–X; the river appears later in the seventh circle.

## Current v4 player and infernal environments — 17 November 2026

The playable Davide and the three in-level environments now use `public/game/v4/`. Built-in ImageGen used the approved campaign portrait `K01-inferno-ritratto-naturale-v8.png`. Davide has visible eyes without sunglasses, short swept-back dark hair, light stubble, a forehead cut and cheek scar, a worn black T-shirt, grey jeans and reference arm tattoos. Both the action atlas and the procedural moving character share this face.

- `actors/davide-body.png`: 384×256 RGBA, 24 ordered 64×64 poses. Existing frame mapping, pivot and footline are preserved.
- `actors/davide-source.png`: 256×256 first-pose source for the existing 84-frame renderer. Nearest-neighbour sampling preserves pixel edges; joints, timing and physics are unchanged.
- `backgrounds/giudecca.webp`, `dite.webp`, `stelle.webp`: opaque 887×1774 pixel-art plates. Icy prison, fiery galleries and ascent toward starlight share carved arches, relief faces and chains. Each plate covers one circle, with lateral parallax, pixel fog at joins and lazy loading by act.

The actor master uses the existing `processGameAtlas` pipeline with `normalize: true`, `sourceLayout: 'components'`, `alphaThreshold: 128`, `normalizationScale: 'sheet'`, `gutter: 3`, `footline: 58`. Backgrounds are exported as WebP quality 94 without creative post-processing. Masters and exact built-in prompts are in the parent workspace under `outputs/game-art-v4/` (`final-prompts.json`). Enemies, bosses and detached VFX remain v3; old player and background assets remain as provenance.

## Earlier environment brief

The three environment atlases share this brief: original 16-bit side-scrolling pixel art; hard pixel clusters and controlled dithering; three independently composited depth layers; DDC's black, cyan, magenta, and off-white palette; no text, gore, generic demons, military imagery, or recognizable elements from existing games.

## Cantica Zero v3 actors and effects

The v3 runtime atlases are original DDC productions generated with the built-in ImageGen mode, then normalized locally with nearest-neighbour scaling and chroma-key transparency. The source images remain in the Codex generated-images archive; project-bound runtime assets live under `public/game/v3/`.

- `actors/davide-body.png`: 6×4 action atlas based on the latest approved Davide reference sheet. The frame order is idle, run, jump/land, three Verse directions, hit, defeat and respawn. Small pose-specific accents from the approved sheet are retained; projectile travel, impacts and gameplay VFX remain detached.
- `actors/enemy-bodies.png`: four original Rumore animation families—masked walker, speaker roller, sentry and flyer—without impact or defeat particles.
- `actors/boss-bodies.png`: Minotauro, Pluto and Caronte split into idle, move, telegraph, attack, hit and defeat body poses. Dissolution is not embedded in the bodies.
- `effects/cantica-vfx-atlas.png`: 24 isolated abstract voice, noise, landing, pickup, fracture, respawn and finale effects. Explosions are rendered as typographic light, ink and fragments rather than weapons, fire, blood or gore.

Final production prompt family: crisp original DDC hand-pixelled arcade artwork with expressive late-1990s timing, hard nearest-neighbour pixel clusters, a controlled black/cyan/magenta/paper-white palette, exact 6×4 grids, stable anchors and a flat `#00FF00` chroma field. Actor prompts require body and held microphone/prop only; the VFX prompt prohibits characters, guns, military imagery, blood, readable text, shadows, gradients, labels and watermarks.

Normalization is reproducible with `scripts/process-game-atlas.mjs`. It validates the 6×4 source geometry, removes ImageGen's green family without erasing cyan accents, can recover the 24 visual poses when a generated figure drifts across an implicit grid, applies a shared family scale, fixes the center and footline, enforces a transparent gutter, and writes optimized 64×64-cell RGBA PNGs. `scripts/validate-game-atlas.mjs` reports green spill, edge intrusion, center jitter and footline jitter per cell.

Davide's production action atlas and the earlier five animation studies (`idle`, `run`, `rise`, `verse`, `hit`) were generated from the project's supplied portraits as identity references. Locked traits: short curls and fade, trimmed beard, square sunglasses, black oversized T-shirt, chain, grey jeans, tattoos, and a microphone. The prompt explicitly prohibited weapons, logos, military poses, and imitation of existing characters.

The earlier runtime used `public/game/v3/actors/davide-body.png`: 24 ordered action frames covering idle, run, jump, fall, landing, ground/air Verse, diagonal Verse, hit, defeat, and respawn. The production frame map omits two source poses whose baked accents displace the body anchor; the aligned poses are paired with the detached VFX atlas instead. Projectile travel, impacts, damage, dissolve and the main respawn effects still come from `public/game/v3/effects/cantica-vfx-atlas.png`.

All generated masters were post-processed locally for transparent backgrounds and integrated through typed frame maps with fixed pivots. The v3 enemies, bosses and effects remain current; the player is superseded by v4; earlier v2 strips remain as documented visual studies and fallback provenance.
