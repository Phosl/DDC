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

## Generated asset brief

The three environment atlases share this brief: original 16-bit side-scrolling pixel art; hard pixel clusters and controlled dithering; three independently composited depth layers; DDC's black, cyan, magenta, and off-white palette; no text, gore, generic demons, military imagery, or recognizable elements from existing games.

## Cantica Zero v3 actors and effects

The v3 runtime atlases are original DDC productions generated with the built-in ImageGen mode, then normalized locally with nearest-neighbour scaling and chroma-key transparency. The source images remain in the Codex generated-images archive; project-bound runtime assets live under `public/game/v3/`.

- `actors/davide-body.png`: body-only 6×4 atlas based on the approved Davide reference sheet. Identity, clothing and microphone are preserved while beams, dust, letters and particles are deliberately excluded.
- `actors/enemy-bodies.png`: four original Rumore animation families—masked walker, speaker roller, sentry and flyer—without impact or defeat particles.
- `actors/boss-bodies.png`: Minotauro, Pluto and Caronte split into idle, move, telegraph, attack, hit and defeat body poses. Dissolution is not embedded in the bodies.
- `effects/cantica-vfx-atlas.png`: 24 isolated abstract voice, noise, landing, pickup, fracture, respawn and finale effects. Explosions are rendered as typographic light, ink and fragments rather than weapons, fire, blood or gore.

Final production prompt family: crisp original DDC hand-pixelled arcade artwork with expressive late-1990s timing, hard nearest-neighbour pixel clusters, a controlled black/cyan/magenta/paper-white palette, exact 6×4 grids, stable anchors and a flat `#00FF00` chroma field. Actor prompts require body and held microphone/prop only; the VFX prompt prohibits characters, guns, military imagery, blood, readable text, shadows, gradients, labels and watermarks.

Normalization is reproducible with `scripts/process-game-atlas.mjs`. It validates the 6×4 source geometry, removes ImageGen's green family without erasing cyan accents, can recover the 24 visual poses when a generated figure drifts across an implicit grid, applies a shared family scale, fixes the center and footline, enforces a transparent gutter, and writes optimized 64×64-cell RGBA PNGs. `scripts/validate-game-atlas.mjs` reports green spill, edge intrusion, center jitter and footline jitter per cell.

Davide's production action atlas and the earlier five animation studies (`idle`, `run`, `rise`, `verse`, `hit`) were generated from the project's supplied portraits as identity references. Locked traits: short curls and fade, trimmed beard, square sunglasses, black oversized T-shirt, chain, grey jeans, tattoos, and a microphone. The prompt explicitly prohibited weapons, logos, military poses, and imitation of existing characters.

The runtime uses `public/game/v3/actors/davide-body.png`: 24 body-only frames covering idle, run, jump, fall, landing, ground/air Verse, diagonal Verse, hit, defeat, and respawn. Its detached muzzle, projectile, impact, landing, damage, dissolve and respawn effects come from `public/game/v3/effects/cantica-vfx-atlas.png`.

All generated masters were post-processed locally for transparent backgrounds and integrated through typed frame maps with fixed pivots. The files under `public/game/v3/` are the current Phaser production atlases; earlier v2 strips remain as documented visual studies and fallback provenance.
