export type GamePhase =
  | "ready"
  | "playing"
  | "paused"
  | "dying"
  | "game-over"
  | "complete";

export type GameInput = {
  moveX: -1 | 0 | 1;
  jumpPressed: boolean;
  jumpHeld: boolean;
  firePressed: boolean;
  fireHeld: boolean;
  pausePressed: boolean;
};

export const INITIAL_GAME_INPUT: Readonly<GameInput> = {
  moveX: 0,
  jumpPressed: false,
  jumpHeld: false,
  firePressed: false,
  fireHeld: false,
  pausePressed: false,
};

export type BossSnapshot = Readonly<{
  id: "minotaur" | "pluto" | "charon";
  name: string;
  health: number;
  maxHealth: number;
}>;

export type GameSnapshot = Readonly<{
  phase: GamePhase;
  elapsedMs: number;
  recordEligible: boolean;
  lives: number;
  breath: number;
  voices: number;
  strofe: number;
  quota: number;
  circleId: string;
  actIndex: 0 | 1 | 2;
  checkpointActIndex: 0 | 1 | 2;
  shield: boolean;
  rimaMs: number;
  boss: BossSnapshot | null;
  bestMs: number | null;
  assist: boolean;
  statusText: string;
}>;

export type GameTelemetry = Readonly<{
  phase: GamePhase;
  breath: number;
  circleId: string;
  player: Readonly<{
    x: number;
    y: number;
    velocityX: number;
    velocityY: number;
    grounded: boolean;
    facing: -1 | 1;
  }>;
  projectile: Readonly<{
    count: number;
    velocityX: number | null;
    velocityY: number | null;
  }>;
}>;

export const GAME_AUDIO_CUES = [
  "jump",
  "land",
  "land-hard",
  "verse",
  "hit",
  "enemy-hit",
  "enemy-break",
  "pickup",
  "shield-break",
  "respawn",
  "checkpoint",
  "boss-enter",
  "boss-telegraph",
  "boss-hit",
  "boss-break",
  "complete",
  "game-over",
] as const;

export type GameAudioCue = (typeof GAME_AUDIO_CUES)[number];

export type GameEvent =
  | Readonly<{ type: "audio"; cue: GameAudioCue }>
  | Readonly<{ type: "announcement"; message: string }>
  | Readonly<{ type: "record"; elapsedMs: number; assist: boolean }>;

export type CreateRiseGameOptions = Readonly<{
  parent: HTMLElement;
  assist?: boolean;
  reducedMotion?: boolean;
  onSnapshot: (snapshot: GameSnapshot) => void;
  onEvent?: (event: GameEvent) => void;
}>;

export interface GameController {
  setInput(input: Partial<GameInput>): void;
  clearInput(): void;
  pause(reason?: string): void;
  resume(): void;
  restart(mode: "full-run" | "continue-act"): void;
  setAssist(enabled: boolean): void;
  setReducedMotion(enabled: boolean): void;
  /** Present only in development, for the deterministic browser campaign test. */
  verifyCampaign?(): GameSnapshot;
  /** Present only in development, for exercising the real damage/respawn lifecycle. */
  verifyDamageRespawn?(): Promise<GameSnapshot>;
  /** Present only in development, for browser tests driven by real DOM input. */
  readTelemetry?(): GameTelemetry;
  destroy(): void;
}
