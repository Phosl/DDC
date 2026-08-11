type PixelContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

type PixelCanvas = HTMLCanvasElement | OffscreenCanvas;

type PixelSurface = {
  canvas: PixelCanvas;
  context: PixelContext;
};

export type RiseGameVisualViewport = {
  width: number;
  height: number;
  dpr?: number;
};

export type RiseGameVisualEntity = {
  id?: number;
  kind: "noise" | "voice";
  x: number;
  y: number;
  radius: number;
  age?: number;
  rotation?: number;
  consumed?: boolean;
};

export type RiseGameVisualProjectile = {
  x: number;
  y: number;
  age?: number;
  consumed?: boolean;
};

export type RiseGameVisualBurst = {
  x: number;
  y: number;
  age?: number;
  tone: "noise" | "voice";
};

export type RiseGameVisualRuntime = {
  viewport: RiseGameVisualViewport;
  elapsedMs: number;
  quota: number;
  playerY: number;
  playerVelocity: number;
  thrusting: boolean;
  entities: readonly RiseGameVisualEntity[];
  projectiles: readonly RiseGameVisualProjectile[];
  bursts: readonly RiseGameVisualBurst[];
};

type ChapterPalette = {
  void: string;
  deep: string;
  middle: string;
  pale: string;
  ink: string;
  magenta: string;
  cyan: string;
};

type SpriteAssets = {
  player: PixelSurface[];
  noise: PixelSurface[][];
  voice: PixelSurface[];
  verses: PixelSurface[];
  bursts: Record<"noise" | "voice", PixelSurface[]>;
};

type RendererCache = {
  logicalWidth: number;
  logicalHeight: number;
  buffer: PixelSurface;
  backgrounds: PixelSurface[];
  parallax: PixelSurface[][];
  sprites: SpriteAssets;
};

const LOGICAL_PIXEL_SIZE = 2;
const MIN_LOGICAL_WIDTH = 144;
const MAX_LOGICAL_WIDTH = 288;
const PARALLAX_SPEEDS = [3, 7, 13] as const;
const BAYER_4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
] as const;

const CHAPTER_PALETTES: readonly ChapterPalette[] = [
  {
    void: "#03050a",
    deep: "#07101d",
    middle: "#14243a",
    pale: "#9aabc0",
    ink: "#f4f0e8",
    magenta: "#ff2a78",
    cyan: "#27e0d1",
  },
  {
    void: "#080407",
    deep: "#17070f",
    middle: "#3a1023",
    pale: "#c891a6",
    ink: "#f4f0e8",
    magenta: "#ff2a78",
    cyan: "#27e0d1",
  },
  {
    void: "#02080c",
    deep: "#071820",
    middle: "#10313a",
    pale: "#9bc7c8",
    ink: "#f4f0e8",
    magenta: "#ff2a78",
    cyan: "#27e0d1",
  },
] as const;

const rendererCaches = new WeakMap<CanvasRenderingContext2D, RendererCache>();

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function createSurface(width: number, height: number): PixelSurface {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));

  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(safeWidth, safeHeight);
    const context = canvas.getContext("2d", { alpha: true });

    if (!context) throw new Error("Canvas 2D non disponibile.");
    context.imageSmoothingEnabled = false;
    return { canvas, context };
  }

  if (typeof document === "undefined") {
    throw new Error("Il renderer pixel-art richiede un ambiente browser.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = safeWidth;
  canvas.height = safeHeight;
  const context = canvas.getContext("2d", { alpha: true });

  if (!context) throw new Error("Canvas 2D non disponibile.");
  context.imageSmoothingEnabled = false;
  return { canvas, context };
}

function resetContext(context: PixelContext) {
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
  context.imageSmoothingEnabled = false;
}

function createSeededRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function drawTinyGlyph(
  context: PixelContext,
  glyph: readonly string[],
  x: number,
  y: number,
  color: string,
) {
  context.fillStyle = color;

  for (let row = 0; row < glyph.length; row += 1) {
    for (let column = 0; column < glyph[row].length; column += 1) {
      if (glyph[row][column] === "1") {
        context.fillRect(x + column, y + row, 1, 1);
      }
    }
  }
}

const TINY_D = ["110", "101", "101", "101", "110"] as const;
const TINY_C = ["111", "100", "100", "100", "111"] as const;

function buildPlayerSprite(frame: number) {
  const surface = createSurface(28, 32);
  const context = surface.context;
  const moving = frame === 1;
  const thrusting = frame === 2;
  const bodyY = moving ? 1 : 0;

  resetContext(context);
  context.clearRect(0, 0, 28, 32);

  if (thrusting) {
    context.fillStyle = "#ff2a78";
    context.fillRect(10, 27, 3, 3);
    context.fillRect(16, 27, 3, 3);
    context.fillRect(11, 30, 2, 2);
    context.fillStyle = "#27e0d1";
    context.fillRect(11, 27, 1, 2);
    context.fillRect(17, 27, 1, 2);
  }

  context.fillStyle = "#05070a";
  context.fillRect(7, 1 + bodyY, 11, 3);
  context.fillRect(5, 4 + bodyY, 15, 8);
  context.fillRect(7, 12 + bodyY, 11, 2);

  context.fillStyle = "#f4f0e8";
  context.fillRect(6, 4 + bodyY, 13, 7);
  context.fillRect(8, 11 + bodyY, 9, 3);
  context.fillRect(5, 14 + bodyY, 15, 10);
  context.fillRect(3, 16 + bodyY, 3, 7);
  context.fillRect(19, 15 + bodyY, 3, 8);

  context.fillStyle = "#080808";
  context.fillRect(7, 6 + bodyY, 5, 3);
  context.fillRect(14, 6 + bodyY, 4, 3);
  context.fillRect(12, 7 + bodyY, 2, 1);
  context.fillRect(9, 11 + bodyY, 7, 1);
  context.fillRect(4, 24 + bodyY, 7, 3);
  context.fillRect(15, 24 + bodyY, 7, 3);

  context.fillStyle = "#27e0d1";
  context.fillRect(11, 7 + bodyY, 1, 1);
  context.fillRect(18, 7 + bodyY, 1, 1);
  context.fillRect(4, 19 + bodyY, 2, 2);

  drawTinyGlyph(context, TINY_D, 7, 16 + bodyY, "#080808");
  drawTinyGlyph(context, TINY_D, 11, 16 + bodyY, "#ff2a78");
  drawTinyGlyph(context, TINY_C, 15, 16 + bodyY, "#080808");

  context.fillStyle = "#ff2a78";
  context.fillRect(23, 8 + bodyY, 3, 3);
  context.fillRect(22, 9 + bodyY, 1, 2);
  context.fillStyle = "#27e0d1";
  context.fillRect(22, 11 + bodyY, 2, 2);
  context.fillRect(21, 13 + bodyY, 2, 5);
  context.fillRect(20, 17 + bodyY, 2, 1);

  return surface;
}

function buildNoiseSprite(variant: number, frame: number) {
  const surface = createSurface(30, 28);
  const context = surface.context;
  const coneInset = frame === 0 ? 3 : 2;
  const hornShift = variant % 3;

  resetContext(context);
  context.clearRect(0, 0, 30, 28);
  context.fillStyle = "#ff2a78";
  context.fillRect(5 + hornShift, 2, 4, 4);
  context.fillRect(21 - hornShift, 2, 4, 4);
  context.fillRect(3, 6, 24, 18);
  context.fillRect(1, 10 + hornShift, 3, 9);
  context.fillRect(27, 8 + (2 - hornShift), 2, 11);
  context.fillRect(6, 24, 5, 3);
  context.fillRect(19, 24, 5, 3);

  context.fillStyle = "#080808";
  context.fillRect(5, 7, 20, 15);
  context.fillRect(2, 7 + hornShift, 4, 3);
  context.fillRect(24, 5 + (2 - hornShift), 4, 3);

  context.fillStyle = "#351020";
  context.fillRect(8, 9, 14, 11);
  context.fillStyle = "#f4f0e8";
  context.fillRect(11, 12, 8, 5);
  context.fillStyle = "#080808";
  context.fillRect(11 + coneInset, 12 + Math.floor(coneInset / 2), 8 - coneInset * 2, 3);
  context.fillRect(7, 7, 3, 2);
  context.fillRect(20, 7, 3, 2);
  context.fillRect(8 + hornShift, 21, 3, 2);
  context.fillRect(19 - hornShift, 21, 3, 2);

  return surface;
}

function buildVoiceSprite(frame: number) {
  const surface = createSurface(20, 22);
  const context = surface.context;
  const pulse = frame === 0 ? 0 : 1;

  resetContext(context);
  context.clearRect(0, 0, 20, 22);
  context.fillStyle = "#27e0d1";
  context.fillRect(8, 1 - pulse, 4, 2);
  context.fillRect(5, 3, 10, 2);
  context.fillRect(3, 5, 14, 12);
  context.fillRect(5, 17, 10, 2);
  context.fillRect(8, 19 + pulse, 4, 2);

  context.fillStyle = "#071820";
  context.fillRect(5, 6, 10, 10);
  context.fillStyle = "#f4f0e8";
  context.fillRect(6, 10, 2, 2);
  context.fillRect(9, 7 + pulse, 2, 8 - pulse * 2);
  context.fillRect(12, 9, 2, 4);
  context.fillStyle = "#ff2a78";
  context.fillRect(9, 10, 2, 2);

  return surface;
}

function buildVerseSprite(frame: number) {
  const surface = createSurface(12, 7);
  const context = surface.context;
  const offset = frame === 0 ? 0 : 1;

  resetContext(context);
  context.clearRect(0, 0, 12, 7);
  context.fillStyle = "#f4f0e8";
  context.fillRect(0, 2 + offset, 4, 2);
  context.fillRect(6, 1, 3, 2);
  context.fillRect(9, 3 - offset, 3, 2);
  context.fillStyle = "#27e0d1";
  context.fillRect(4, 3, 2, 2);
  context.fillStyle = "#ff2a78";
  context.fillRect(8, 5, 2, 1);

  return surface;
}

function buildBurstSprite(tone: "noise" | "voice", frame: number) {
  const surface = createSurface(28, 28);
  const context = surface.context;
  const color = tone === "voice" ? "#27e0d1" : "#ff2a78";
  const reach = 3 + frame * 2;
  const center = 14;

  resetContext(context);
  context.clearRect(0, 0, 28, 28);
  context.fillStyle = color;
  context.fillRect(center - 1, center - reach - 2, 2, 3);
  context.fillRect(center - 1, center + reach, 2, 3);
  context.fillRect(center - reach - 2, center - 1, 3, 2);
  context.fillRect(center + reach, center - 1, 3, 2);
  context.fillRect(center - reach, center - reach, 2, 2);
  context.fillRect(center + reach - 1, center - reach, 2, 2);
  context.fillRect(center - reach, center + reach - 1, 2, 2);
  context.fillRect(center + reach - 1, center + reach - 1, 2, 2);

  if (frame === 0) {
    context.fillStyle = "#f4f0e8";
    context.fillRect(center - 2, center - 2, 4, 4);
  }

  return surface;
}

function buildSpriteAssets(): SpriteAssets {
  return {
    player: [0, 1, 2].map(buildPlayerSprite),
    noise: [0, 1, 2].map((variant) =>
      [0, 1].map((frame) => buildNoiseSprite(variant, frame)),
    ),
    voice: [0, 1].map(buildVoiceSprite),
    verses: [0, 1].map(buildVerseSprite),
    bursts: {
      noise: [0, 1, 2, 3].map((frame) => buildBurstSprite("noise", frame)),
      voice: [0, 1, 2, 3].map((frame) => buildBurstSprite("voice", frame)),
    },
  };
}

function paintDitheredField(
  context: PixelContext,
  width: number,
  height: number,
  color: string,
  densityAt: (x: number, y: number) => number,
) {
  context.fillStyle = color;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const density = clamp(densityAt(x, y), 0, 1);
      if (BAYER_4[y & 3][x & 3] < density * 16) {
        context.fillRect(x, y, 1, 1);
      }
    }
  }
}

function drawGiudeccaBackground(
  context: PixelContext,
  width: number,
  height: number,
  palette: ChapterPalette,
) {
  context.fillStyle = palette.void;
  context.fillRect(0, 0, width, height);

  paintDitheredField(context, width, height, palette.deep, (_x, y) => {
    const depth = y / Math.max(1, height - 1);
    return 0.08 + depth * 0.68;
  });

  context.fillStyle = palette.middle;
  for (let y = 18; y < height; y += 34) {
    context.fillRect(0, y, width, 1);
    context.fillRect(0, y + 2, Math.floor(width * 0.36), 1);
    context.fillRect(Math.floor(width * 0.68), y + 3, width, 1);
  }

  const random = createSeededRandom(0x6a1decca + width * 31 + height);
  context.fillStyle = palette.pale;
  for (let index = 0; index < Math.ceil(width / 11); index += 1) {
    const x = Math.floor(random() * width);
    const y = Math.floor(height * (0.18 + random() * 0.72));
    context.fillRect(x, y, 1, 2 + Math.floor(random() * 5));
  }
}

function drawDiteBackground(
  context: PixelContext,
  width: number,
  height: number,
  palette: ChapterPalette,
) {
  context.fillStyle = palette.void;
  context.fillRect(0, 0, width, height);

  paintDitheredField(context, width, height, palette.deep, (_x, y) => {
    const horizon = Math.abs(y / Math.max(1, height) - 0.56);
    return clamp(0.7 - horizon, 0.12, 0.62);
  });

  const random = createSeededRandom(0xd17ec17a + width * 13 + height * 3);
  context.fillStyle = palette.middle;
  let cursor = 0;
  const horizon = Math.floor(height * 0.64);

  while (cursor < width) {
    const towerWidth = 8 + Math.floor(random() * 13);
    const towerHeight = 12 + Math.floor(random() * 34);
    context.fillRect(cursor, horizon - towerHeight, towerWidth, towerHeight);
    context.fillRect(cursor + 2, horizon - towerHeight - 3, 2, 3);
    context.fillRect(cursor + towerWidth - 4, horizon - towerHeight - 3, 2, 3);
    cursor += towerWidth + 2 + Math.floor(random() * 5);
  }

  context.fillStyle = palette.magenta;
  for (let x = 5; x < width; x += 17) {
    context.fillRect(x, horizon - 16 - (x % 11), 2, 2);
  }
}

function drawStarsBackground(
  context: PixelContext,
  width: number,
  height: number,
  palette: ChapterPalette,
) {
  context.fillStyle = palette.void;
  context.fillRect(0, 0, width, height);

  paintDitheredField(context, width, height, palette.deep, (_x, y) => {
    const depth = y / Math.max(1, height - 1);
    return 0.05 + depth * depth * 0.55;
  });

  const random = createSeededRandom(0x57a25 + width * 17 + height * 5);
  for (let index = 0; index < Math.ceil((width * height) / 1_500); index += 1) {
    const x = Math.floor(random() * width);
    const y = Math.floor(random() * height * 0.7);
    context.fillStyle = index % 5 === 0 ? palette.cyan : palette.ink;
    context.fillRect(x, y, index % 7 === 0 ? 2 : 1, 1);
  }

  context.fillStyle = palette.middle;
  context.fillRect(0, Math.floor(height * 0.84), width, Math.ceil(height * 0.16));
}

function drawStaticScanlines(
  context: PixelContext,
  width: number,
  height: number,
  color: string,
) {
  context.fillStyle = color;
  context.globalAlpha = 0.22;
  for (let y = 3; y < height; y += 4) context.fillRect(0, y, width, 1);
  context.globalAlpha = 1;
}

function buildChapterBackground(
  chapterIndex: number,
  width: number,
  height: number,
) {
  const surface = createSurface(width, height);
  const context = surface.context;
  const palette = CHAPTER_PALETTES[chapterIndex];

  resetContext(context);
  if (chapterIndex === 0) {
    drawGiudeccaBackground(context, width, height, palette);
  } else if (chapterIndex === 1) {
    drawDiteBackground(context, width, height, palette);
  } else {
    drawStarsBackground(context, width, height, palette);
  }
  drawStaticScanlines(context, width, height, palette.void);

  return surface;
}

function drawGiudeccaLayer(
  context: PixelContext,
  width: number,
  height: number,
  layer: number,
  palette: ChapterPalette,
  random: () => number,
) {
  const color = layer === 0 ? palette.deep : layer === 1 ? palette.middle : "#1c2e44";
  context.fillStyle = color;
  const ceiling = 5 + layer * 5;
  const floor = height - 5 - layer * 7;

  context.fillRect(0, 0, width, ceiling);
  context.fillRect(0, floor, width, height - floor);

  for (let x = 0; x < width; x += 7 + layer * 2) {
    const topDepth = 3 + Math.floor(random() * (12 + layer * 4));
    const bottomDepth = 4 + Math.floor(random() * (15 + layer * 5));
    context.fillRect(x, ceiling, 3 + (x % 3), topDepth);
    context.fillRect(x + 2, floor - bottomDepth, 4, bottomDepth);
  }
}

function drawDiteLayer(
  context: PixelContext,
  width: number,
  height: number,
  layer: number,
  palette: ChapterPalette,
  random: () => number,
) {
  const baseline = Math.floor(height * (0.8 + layer * 0.045));
  const color = layer === 0 ? palette.deep : layer === 1 ? palette.middle : "#59132f";
  context.fillStyle = color;
  context.fillRect(0, baseline, width, height - baseline);

  let x = 0;
  while (x < width) {
    const buildingWidth = 9 + Math.floor(random() * (13 + layer * 4));
    const buildingHeight = 12 + Math.floor(random() * (20 + layer * 9));
    context.fillRect(x, baseline - buildingHeight, buildingWidth, buildingHeight);
    if (layer > 0) {
      context.fillRect(x + 2, baseline - buildingHeight - 4, 2, 4);
    }
    x += buildingWidth + 2 + Math.floor(random() * 5);
  }

  if (layer === 2) {
    context.fillStyle = palette.magenta;
    for (let windowX = 5; windowX < width; windowX += 19) {
      context.fillRect(windowX, baseline - 14 - (windowX % 9), 2, 2);
    }
  }
}

function drawStarsLayer(
  context: PixelContext,
  width: number,
  height: number,
  layer: number,
  palette: ChapterPalette,
  random: () => number,
) {
  if (layer === 0) {
    context.fillStyle = palette.pale;
    for (let index = 0; index < Math.ceil(width / 18); index += 1) {
      const x = Math.floor(random() * width);
      const y = Math.floor(random() * height * 0.5);
      context.fillRect(x, y, index % 4 === 0 ? 2 : 1, 1);
    }
    return;
  }

  const baseline = Math.floor(height * (layer === 1 ? 0.89 : 0.83));
  context.fillStyle = layer === 1 ? palette.middle : "#071218";
  context.fillRect(0, baseline, width, height - baseline);

  let x = 0;
  while (x < width) {
    const roofWidth = 12 + Math.floor(random() * 18);
    const roofHeight = 4 + Math.floor(random() * 11);
    context.fillRect(x, baseline - roofHeight, roofWidth, roofHeight);
    context.fillRect(x + Math.floor(roofWidth / 2), baseline - roofHeight - 8, 1, 8);
    if (layer === 2 && x % 3 === 0) {
      context.fillStyle = palette.cyan;
      context.fillRect(x + Math.floor(roofWidth / 2) - 1, baseline - roofHeight - 9, 3, 1);
      context.fillStyle = "#071218";
    }
    x += roofWidth;
  }
}

function buildParallaxTile(
  chapterIndex: number,
  layer: number,
  width: number,
  height: number,
) {
  const surface = createSurface(width, height);
  const context = surface.context;
  const palette = CHAPTER_PALETTES[chapterIndex];
  const random = createSeededRandom(
    0xabc123 + chapterIndex * 10_007 + layer * 977 + width * 7 + height,
  );

  resetContext(context);
  context.clearRect(0, 0, width, height);

  if (chapterIndex === 0) {
    drawGiudeccaLayer(context, width, height, layer, palette, random);
  } else if (chapterIndex === 1) {
    drawDiteLayer(context, width, height, layer, palette, random);
  } else {
    drawStarsLayer(context, width, height, layer, palette, random);
  }

  return surface;
}

function createRendererCache(): RendererCache {
  return {
    logicalWidth: 0,
    logicalHeight: 0,
    buffer: createSurface(1, 1),
    backgrounds: [],
    parallax: [],
    sprites: buildSpriteAssets(),
  };
}

function getRendererCache(context: CanvasRenderingContext2D) {
  const cached = rendererCaches.get(context);
  if (cached) return cached;

  const created = createRendererCache();
  rendererCaches.set(context, created);
  return created;
}

function ensureSizedCache(
  cache: RendererCache,
  viewportWidth: number,
  viewportHeight: number,
) {
  const logicalWidth = clamp(
    Math.round(viewportWidth / LOGICAL_PIXEL_SIZE),
    MIN_LOGICAL_WIDTH,
    MAX_LOGICAL_WIDTH,
  );
  const aspect = viewportHeight / Math.max(1, viewportWidth);
  const logicalHeight = Math.max(180, Math.round(logicalWidth * aspect));

  if (
    cache.logicalWidth === logicalWidth &&
    cache.logicalHeight === logicalHeight
  ) {
    return;
  }

  cache.logicalWidth = logicalWidth;
  cache.logicalHeight = logicalHeight;
  cache.buffer = createSurface(logicalWidth, logicalHeight);
  cache.backgrounds = [0, 1, 2].map((chapterIndex) =>
    buildChapterBackground(chapterIndex, logicalWidth, logicalHeight),
  );

  const tileWidth = Math.max(96, Math.ceil(logicalWidth * 0.72));
  cache.parallax = [0, 1, 2].map((chapterIndex) =>
    [0, 1, 2].map((layer) =>
      buildParallaxTile(
        chapterIndex,
        layer,
        tileWidth,
        logicalHeight,
      ),
    ),
  );
}

function drawRepeatedTile(
  context: PixelContext,
  surface: PixelSurface,
  outputWidth: number,
  offset: number,
) {
  const tileWidth = surface.canvas.width;
  const normalizedOffset = -positiveModulo(Math.floor(offset), tileWidth);

  for (let x = normalizedOffset - tileWidth; x < outputWidth; x += tileWidth) {
    context.drawImage(surface.canvas, x, 0);
  }
}

function drawParallax(
  context: PixelContext,
  cache: RendererCache,
  chapterIndex: number,
  elapsedMs: number,
  reducedMotion: boolean,
) {
  const timeSeconds = elapsedMs / 1_000;
  const layers = cache.parallax[chapterIndex];

  for (let layer = 0; layer < layers.length; layer += 1) {
    const offset = reducedMotion ? 0 : timeSeconds * PARALLAX_SPEEDS[layer];
    drawRepeatedTile(context, layers[layer], cache.logicalWidth, offset);
  }
}

function drawAltitudeMarker(
  context: PixelContext,
  width: number,
  height: number,
  quota: number,
  palette: ChapterPalette,
) {
  const progress = clamp((quota + 900) / 1_380, 0, 1);
  const markerY = Math.round(height - 8 - progress * (height - 16));

  context.fillStyle = palette.deep;
  context.fillRect(4, 7, 2, height - 14);
  context.fillStyle = palette.cyan;
  context.fillRect(3, markerY, 4, 5);
  context.fillStyle = palette.ink;
  context.fillRect(4, markerY + 1, 2, 3);
}

function drawBursts(
  context: PixelContext,
  runtime: RiseGameVisualRuntime,
  cache: RendererCache,
  scaleX: number,
  scaleY: number,
  reducedMotion: boolean,
  cameraX: number,
) {
  for (const burst of runtime.bursts) {
    const age = burst.age ?? 0;
    const frame = reducedMotion ? 1 : clamp(Math.floor(age * 14), 0, 3);
    const sprite = cache.sprites.bursts[burst.tone][frame];
    const x = Math.round(burst.x * scaleX) - 14 + cameraX;
    const y = Math.round(burst.y * scaleY) - 14;
    context.drawImage(sprite.canvas, x, y);
  }
}

function drawProjectiles(
  context: PixelContext,
  runtime: RiseGameVisualRuntime,
  cache: RendererCache,
  scaleX: number,
  scaleY: number,
  reducedMotion: boolean,
  cameraX: number,
) {
  for (const projectile of runtime.projectiles) {
    if (projectile.consumed) continue;
    const frame = reducedMotion
      ? 0
      : Math.floor(((projectile.age ?? 0) * 10) % cache.sprites.verses.length);
    const sprite = cache.sprites.verses[frame];
    const x = Math.round(projectile.x * scaleX) + cameraX;
    const y = Math.round(projectile.y * scaleY) - 3;
    context.drawImage(sprite.canvas, x, y);
  }
}

function drawEntities(
  context: PixelContext,
  runtime: RiseGameVisualRuntime,
  cache: RendererCache,
  scaleX: number,
  scaleY: number,
  reducedMotion: boolean,
  cameraX: number,
) {
  for (const entity of runtime.entities) {
    if (entity.consumed) continue;

    const age = entity.age ?? 0;
    const centerX = Math.round(entity.x * scaleX) + cameraX;
    const centerY = Math.round(entity.y * scaleY);

    if (entity.kind === "noise") {
      const variant = positiveModulo(entity.id ?? 0, cache.sprites.noise.length);
      const frames = cache.sprites.noise[variant];
      const frame = reducedMotion ? 0 : Math.floor(age * 6) % frames.length;
      const sprite = frames[frame];
      const size = clamp(Math.round(entity.radius * scaleX * 2.15), 18, 36);
      context.drawImage(
        sprite.canvas,
        centerX - Math.floor(size / 2),
        centerY - Math.floor(size / 2),
        size,
        size,
      );
    } else {
      const frame = reducedMotion
        ? 0
        : Math.floor(age * 7) % cache.sprites.voice.length;
      const sprite = cache.sprites.voice[frame];
      const size = clamp(Math.round(entity.radius * scaleX * 2), 14, 24);
      context.drawImage(
        sprite.canvas,
        centerX - Math.floor(size / 2),
        centerY - Math.floor(size / 2),
        size,
        Math.round(size * 1.1),
      );
    }
  }
}

function drawPlayer(
  context: PixelContext,
  runtime: RiseGameVisualRuntime,
  cache: RendererCache,
  scaleX: number,
  scaleY: number,
  reducedMotion: boolean,
  cameraX: number,
) {
  const playerX = Math.max(68, runtime.viewport.width * 0.24);
  const movingQuickly = Math.abs(runtime.playerVelocity) > 95;
  const frame = runtime.thrusting
    ? 2
    : reducedMotion
      ? 0
      : movingQuickly
        ? 1
        : Math.floor(runtime.elapsedMs / 180) % 2;
  const sprite = cache.sprites.player[frame];
  const x = Math.round(playerX * scaleX) - 13 + cameraX;
  const y = Math.round(runtime.playerY * scaleY) - 15;

  context.drawImage(sprite.canvas, x, y);

  if (runtime.thrusting && !reducedMotion) {
    const afterFrame = cache.sprites.player[2];
    context.globalAlpha = 0.18;
    context.drawImage(afterFrame.canvas, x, y + 3);
    context.globalAlpha = 1;
  }
}

function getCameraOffset(runtime: RiseGameVisualRuntime, reducedMotion: boolean) {
  if (reducedMotion) return 0;
  const activeBurst = runtime.bursts.find((burst) => (burst.age ?? 1) < 0.13);
  if (!activeBurst) return 0;
  return (Math.floor(runtime.elapsedMs / 34) % 3) - 1;
}

export function drawRiseGameScene(
  context: CanvasRenderingContext2D,
  runtime: RiseGameVisualRuntime,
  reducedMotion: boolean,
  chapterIndex: number,
) {
  const viewportWidth = Math.max(1, runtime.viewport.width);
  const viewportHeight = Math.max(1, runtime.viewport.height);
  const safeChapterIndex = clamp(Math.trunc(chapterIndex), 0, 2);
  const palette = CHAPTER_PALETTES[safeChapterIndex];
  const cache = getRendererCache(context);

  ensureSizedCache(cache, viewportWidth, viewportHeight);

  const bufferContext = cache.buffer.context;
  const scaleX = cache.logicalWidth / viewportWidth;
  const scaleY = cache.logicalHeight / viewportHeight;
  const cameraX = getCameraOffset(runtime, reducedMotion);

  resetContext(bufferContext);
  bufferContext.drawImage(cache.backgrounds[safeChapterIndex].canvas, 0, 0);
  drawParallax(
    bufferContext,
    cache,
    safeChapterIndex,
    runtime.elapsedMs,
    reducedMotion,
  );
  drawAltitudeMarker(
    bufferContext,
    cache.logicalWidth,
    cache.logicalHeight,
    runtime.quota,
    palette,
  );
  drawBursts(
    bufferContext,
    runtime,
    cache,
    scaleX,
    scaleY,
    reducedMotion,
    cameraX,
  );
  drawProjectiles(
    bufferContext,
    runtime,
    cache,
    scaleX,
    scaleY,
    reducedMotion,
    cameraX,
  );
  drawEntities(
    bufferContext,
    runtime,
    cache,
    scaleX,
    scaleY,
    reducedMotion,
    cameraX,
  );
  drawPlayer(
    bufferContext,
    runtime,
    cache,
    scaleX,
    scaleY,
    reducedMotion,
    cameraX,
  );

  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
  context.imageSmoothingEnabled = false;
  context.drawImage(
    cache.buffer.canvas,
    0,
    0,
    cache.logicalWidth,
    cache.logicalHeight,
    0,
    0,
    context.canvas.width,
    context.canvas.height,
  );
  context.restore();
}
