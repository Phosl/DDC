export type RiseGamePlayerClipName =
  | "idle"
  | "run"
  | "rise"
  | "verse"
  | "hit";

export type RiseGameSpriteFrame = Readonly<{
  image: HTMLImageElement;
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
}>;

export type RiseGamePlayerClip = Readonly<{
  frames: readonly RiseGameSpriteFrame[];
  fps: number;
  playback: "loop" | "once";
  reducedMotionFrame: number;
  anchorY: number;
  height: number;
}>;

export type RiseGameChapterVisuals = Readonly<{
  far: HTMLImageElement;
  middle: HTMLImageElement;
  near: HTMLImageElement;
}>;

export type RiseGameVisualAssets = Readonly<{
  chapters: readonly RiseGameChapterVisuals[];
  player: Readonly<Record<RiseGamePlayerClipName, RiseGamePlayerClip>>;
}>;

type SpriteFrameRect = readonly [
  sourceX: number,
  sourceWidth: number,
];

type PlayerClipSource = Readonly<{
  src: string;
  frameHeight: number;
  frameRects: readonly SpriteFrameRect[];
  fps: number;
  playback: "loop" | "once";
  reducedMotionFrame: number;
  anchorY: number;
  height: number;
}>;

const CHAPTER_SOURCES = [
  {
    far: "/game/backgrounds/giudecca-far.webp",
    middle: "/game/backgrounds/giudecca-mid.webp",
    near: "/game/backgrounds/giudecca-near.webp",
  },
  {
    far: "/game/backgrounds/dite-far.webp",
    middle: "/game/backgrounds/dite-mid.webp",
    near: "/game/backgrounds/dite-near.webp",
  },
  {
    far: "/game/backgrounds/stelle-far.webp",
    middle: "/game/backgrounds/stelle-mid.webp",
    near: "/game/backgrounds/stelle-near.webp",
  },
] as const;

const PLAYER_CLIP_SOURCES: Readonly<
  Record<RiseGamePlayerClipName, PlayerClipSource>
> = {
  idle: {
    src: "/game/sprites/davide-idle.webp",
    frameHeight: 250,
    frameRects: [
      [0, 160],
      [155, 165],
      [315, 170],
    ],
    fps: 5,
    playback: "loop",
    reducedMotionFrame: 0,
    anchorY: 0.51,
    height: 46,
  },
  run: {
    src: "/game/sprites/davide-run.webp",
    frameHeight: 225,
    frameRects: [
      [0, 180],
      [175, 180],
      [345, 180],
      [510, 180],
      [680, 180],
      [850, 180],
      [1_020, 190],
    ],
    fps: 12,
    playback: "loop",
    reducedMotionFrame: 3,
    anchorY: 0.5,
    height: 44,
  },
  rise: {
    src: "/game/sprites/davide-rise.webp",
    frameHeight: 245,
    frameRects: [
      [0, 170],
      [170, 180],
      [345, 185],
      [530, 185],
      [710, 190],
    ],
    fps: 10,
    playback: "loop",
    reducedMotionFrame: 2,
    anchorY: 0.34,
    height: 50,
  },
  verse: {
    src: "/game/sprites/davide-verse.webp",
    frameHeight: 220,
    frameRects: [
      [0, 160],
      [145, 175],
      [310, 180],
      [505, 185],
      [705, 200],
      [925, 210],
    ],
    fps: 36,
    playback: "once",
    reducedMotionFrame: 3,
    anchorY: 0.5,
    height: 46,
  },
  hit: {
    src: "/game/sprites/davide-hit.webp",
    frameHeight: 250,
    frameRects: [
      [0, 180],
      [180, 180],
      [360, 180],
      [530, 180],
    ],
    fps: 10,
    playback: "once",
    reducedMotionFrame: 3,
    anchorY: 0.5,
    height: 46,
  },
} as const;

let loadedAssets: RiseGameVisualAssets | null = null;
let loadingAssets: Promise<RiseGameVisualAssets | null> | null = null;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Impossibile caricare ${src}`));
    image.src = src;
  });
}

function buildClip(
  image: HTMLImageElement,
  source: PlayerClipSource,
): RiseGamePlayerClip {
  return {
    frames: source.frameRects.map(([sourceX, sourceWidth]) => ({
      image,
      sourceX,
      sourceY: 0,
      sourceWidth,
      sourceHeight: source.frameHeight,
    })),
    fps: source.fps,
    playback: source.playback,
    reducedMotionFrame: source.reducedMotionFrame,
    anchorY: source.anchorY,
    height: source.height,
  };
}

export function preloadRiseGameVisualAssets() {
  if (loadedAssets) return Promise.resolve(loadedAssets);
  if (loadingAssets) return loadingAssets;
  if (typeof Image === "undefined") return Promise.resolve(null);

  loadingAssets = (async () => {
    const chapterImages = await Promise.all(
      CHAPTER_SOURCES.map(async (chapter) => {
        const [far, middle, near] = await Promise.all([
          loadImage(chapter.far),
          loadImage(chapter.middle),
          loadImage(chapter.near),
        ]);
        return { far, middle, near };
      }),
    );

    const clipEntries = await Promise.all(
      (Object.entries(PLAYER_CLIP_SOURCES) as Array<
        [RiseGamePlayerClipName, PlayerClipSource]
      >).map(async ([name, source]) => {
        const image = await loadImage(source.src);
        return [name, buildClip(image, source)] as const;
      }),
    );

    loadedAssets = {
      chapters: chapterImages,
      player: Object.fromEntries(clipEntries) as Record<
        RiseGamePlayerClipName,
        RiseGamePlayerClip
      >,
    };

    return loadedAssets;
  })().catch(() => {
    loadingAssets = null;
    return null;
  });

  return loadingAssets;
}

export function getRiseGameVisualAssets() {
  return loadedAssets;
}

export function sampleRiseGamePlayerClip(
  clip: RiseGamePlayerClip,
  ageSeconds: number,
  reducedMotion: boolean,
) {
  const maxFrame = Math.max(0, clip.frames.length - 1);
  const frameIndex = reducedMotion
    ? Math.min(clip.reducedMotionFrame, maxFrame)
    : clip.playback === "loop"
      ? Math.floor(Math.max(0, ageSeconds) * clip.fps) % clip.frames.length
      : Math.min(Math.floor(Math.max(0, ageSeconds) * clip.fps), maxFrame);

  return clip.frames[frameIndex];
}
