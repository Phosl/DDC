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

Davide's production action atlas and the earlier five animation studies (`idle`, `run`, `rise`, `verse`, `hit`) were generated from the project's supplied portraits as identity references. Locked traits: short curls and fade, trimmed beard, square sunglasses, black oversized T-shirt, chain, grey jeans, tattoos, and a microphone. The prompt explicitly prohibited weapons, logos, military poses, and imitation of existing characters.

The runtime uses the revised `public/game/v2/sprites/davide-atlas-v2.png`: 24 distinct frames covering idle, run, jump, fall, landing, ground/air Verse, diagonal Verse, hit, defeat, and respawn.

All generated masters were post-processed locally for transparent backgrounds and integrated through typed frame maps with fixed pivots. The files under `public/game/v2/` are the current Phaser production atlases; earlier strips remain as documented visual studies.
