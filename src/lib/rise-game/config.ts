import { WORLD_WIDTH } from "./level-data";

export { LEVEL_HEIGHT, TILE_SIZE, WORLD_HEIGHT, WORLD_WIDTH } from "./level-data";

export const GAME_WIDTH = WORLD_WIDTH;
export const GAME_HEIGHT = 672;

export const PLAYER = {
  width: 22,
  height: 32,
  speed: 160,
  gravity: 1_100,
  jumpVelocity: -420,
  maxFallVelocity: 600,
  coyoteMs: 100,
  jumpBufferMs: 120,
  invulnerableMs: 1_200,
} as const;

export const ASSIST_PLAYER = {
  speed: 170,
  gravity: 1_020,
  jumpVelocity: -430,
  coyoteMs: 165,
  jumpBufferMs: 180,
  invulnerableMs: 1_800,
} as const;

export const COMBAT = {
  maxBreath: 100,
  shotCost: 12,
  fireIntervalMs: 200,
  rechargeDelayMs: 350,
  rechargePerSecond: 26,
  rimaDurationMs: 7_000,
  projectileSpeed: 430,
  projectileLifetimeMs: 1_200,
  maxProjectiles: 24,
} as const;

export const SNAPSHOT_INTERVAL_MS = 100;
export const RECORD_STORAGE_KEY = {
  standard: "cantica-zero:record:standard",
  assist: "cantica-zero:record:assist",
} as const;
