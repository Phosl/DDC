import { LEVEL_HEIGHT, WORLD_WIDTH } from "./level-data";
import { DIFFICULTY_TUNING } from "./difficulty";
import type { GameViewportMode } from "./types";

export { LEVEL_HEIGHT, TILE_SIZE, WORLD_HEIGHT, WORLD_WIDTH } from "./level-data";
export { DIFFICULTY_TUNING, getDifficultyTuning } from "./difficulty";

export const GAME_WIDTH = WORLD_WIDTH;
export const GAME_HEIGHT = 672;
export const MAX_GAME_WIDTH = GAME_HEIGHT * 4;

export type RuntimeViewportSize = Readonly<{
  width: number;
  height: number;
}>;

export type RuntimeWorldGeometry = Readonly<{
  left: number;
  right: number;
  width: number;
  mapLeft: number;
  mapRight: number;
  /** Distance from the physical world edge to the authored 384-unit map. */
  mapOffsetX: number;
}>;

export type AdaptiveHorizontalRole =
  | "fixed"
  | "pin-left"
  | "pin-right"
  | "extend-left"
  | "extend-right"
  | "fill";

export function resolveRuntimeWorldGeometry(viewportWidth: number): RuntimeWorldGeometry {
  const width =
    Number.isFinite(viewportWidth) && viewportWidth > 0
      ? Math.max(GAME_WIDTH, Math.round(viewportWidth))
      : GAME_WIDTH;
  const left = (GAME_WIDTH - width) / 2;
  return {
    left,
    right: left + width,
    width,
    mapLeft: 0,
    mapRight: GAME_WIDTH,
    mapOffsetX: left === 0 ? 0 : -left,
  };
}

export function resolveAdaptiveHorizontalBounds({
  role,
  authoredLeft,
  authoredRight,
  geometry,
}: Readonly<{
  role: AdaptiveHorizontalRole;
  authoredLeft: number;
  authoredRight: number;
  geometry: RuntimeWorldGeometry;
}>): Readonly<{ left: number; right: number; width: number; centerX: number }> {
  const authoredWidth = Math.max(1, authoredRight - authoredLeft);
  let left = authoredLeft;
  let right = authoredRight;

  if (role === "pin-left") {
    left = geometry.left;
    right = left + authoredWidth;
  } else if (role === "pin-right") {
    right = geometry.right;
    left = right - authoredWidth;
  } else if (role === "extend-left") {
    left = geometry.left;
  } else if (role === "extend-right") {
    right = geometry.right;
  } else if (role === "fill") {
    left = geometry.left;
    right = geometry.right;
  }

  const width = Math.max(1, right - left);
  return { left, right, width, centerX: left + width / 2 };
}

export type BackgroundTileTransform = Readonly<{
  scaleX: number;
  scaleY: number;
  positionX: number;
  positionY: number;
}>;

/**
 * Keeps the authored portrait treatment untouched, then uses a uniform cover
 * crop in adaptive-wide mode so a background never wraps or deforms.
 */
export function resolveBackgroundTileTransform({
  viewportWidth,
  textureWidth,
  textureHeight,
}: Readonly<{
  viewportWidth: number;
  textureWidth: number;
  textureHeight: number;
}>): BackgroundTileTransform {
  if (
    viewportWidth <= GAME_WIDTH ||
    !Number.isFinite(textureWidth) ||
    !Number.isFinite(textureHeight) ||
    textureWidth <= 0 ||
    textureHeight <= 0
  ) {
    return { scaleX: 0.5, scaleY: 0.5, positionX: 0, positionY: 0 };
  }

  const scale = Math.max(viewportWidth / textureWidth, LEVEL_HEIGHT / textureHeight);
  return {
    scaleX: scale,
    scaleY: scale,
    positionX: Math.max(0, (textureWidth - viewportWidth / scale) / 2),
    positionY: Math.max(0, (textureHeight - LEVEL_HEIGHT / scale) / 2),
  };
}

export function resolveRuntimeViewportSize({
  mode,
  parentWidth,
  parentHeight,
}: Readonly<{
  mode: GameViewportMode;
  parentWidth: number;
  parentHeight: number;
}>): RuntimeViewportSize {
  if (
    mode === "portrait" ||
    !Number.isFinite(parentWidth) ||
    !Number.isFinite(parentHeight) ||
    parentWidth <= 0 ||
    parentHeight <= 0
  ) {
    return { width: GAME_WIDTH, height: GAME_HEIGHT };
  }

  return {
    width: Math.min(
      MAX_GAME_WIDTH,
      Math.max(GAME_WIDTH, Math.ceil((GAME_HEIGHT * parentWidth) / parentHeight)),
    ),
    height: GAME_HEIGHT,
  };
}

// Compatibility aliases for the Phaser bootstrap and existing internal imports.
// Runtime gameplay always reads DIFFICULTY_TUNING through getDifficultyTuning.
export const PLAYER = DIFFICULTY_TUNING.standard.player;
export const ASSIST_PLAYER = DIFFICULTY_TUNING.assist.player;
export const COMBAT = DIFFICULTY_TUNING.standard.combat;

export const SNAPSHOT_INTERVAL_MS = 100;
export const RECORD_STORAGE_KEY = {
  standard: "cantica-zero:record:standard",
  assist: "cantica-zero:record:assist",
} as const;
