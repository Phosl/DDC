import { WORLD_WIDTH } from "./level-data";
import { DIFFICULTY_TUNING } from "./difficulty";

export { LEVEL_HEIGHT, TILE_SIZE, WORLD_HEIGHT, WORLD_WIDTH } from "./level-data";
export { DIFFICULTY_TUNING, getDifficultyTuning } from "./difficulty";

export const GAME_WIDTH = WORLD_WIDTH;
export const GAME_HEIGHT = 672;

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
