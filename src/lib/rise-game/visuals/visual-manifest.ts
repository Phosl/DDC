export const ACTOR_ATLAS = {
  player: {
    key: "cantica-player-v3",
    path: "/game/v3/actors/davide-body.png",
    frameWidth: 64,
    frameHeight: 64,
    columns: 6,
    rows: 4,
  },
  enemy: {
    key: "cantica-enemy-v3",
    path: "/game/v3/actors/enemy-bodies.png",
    frameWidth: 64,
    frameHeight: 64,
    columns: 6,
    rows: 4,
  },
  boss: {
    key: "cantica-boss-v3",
    path: "/game/v3/actors/boss-bodies.png",
    frameWidth: 64,
    frameHeight: 64,
    columns: 6,
    rows: 4,
  },
} as const;

export type ActorAtlasId = keyof typeof ACTOR_ATLAS;

export type ActorAnimationDefinition = Readonly<{
  key: string;
  textureKey: (typeof ACTOR_ATLAS)[ActorAtlasId]["key"];
  frames: readonly number[];
  frameRate: number;
  durationMs?: number;
  repeat: number;
  priority: number;
  lockUntilComplete?: boolean;
  hideOnComplete?: boolean;
}>;

export const PLAYER_VISUAL = {
  display: { width: 48, height: 64 },
  pivot: { x: 32, y: 58 },
  animations: {
    idle: {
      key: "davide-v3-idle",
      textureKey: ACTOR_ATLAS.player.key,
      frames: [0, 1, 2, 3, 4, 5] as readonly number[],
      frameRate: 6,
      repeat: -1,
      priority: 0,
    },
    run: {
      key: "davide-v3-run",
      textureKey: ACTOR_ATLAS.player.key,
      frames: [6, 7, 8, 9, 10, 11] as readonly number[],
      frameRate: 14,
      repeat: -1,
      priority: 10,
    },
    "jump-start": {
      key: "davide-v3-jump-start",
      textureKey: ACTOR_ATLAS.player.key,
      frames: [12, 13] as readonly number[],
      frameRate: 14,
      repeat: 0,
      priority: 60,
      lockUntilComplete: true,
    },
    jump: {
      key: "davide-v3-jump",
      textureKey: ACTOR_ATLAS.player.key,
      frames: [14] as readonly number[],
      frameRate: 10,
      repeat: -1,
      priority: 30,
    },
    fall: {
      key: "davide-v3-fall",
      textureKey: ACTOR_ATLAS.player.key,
      frames: [15, 16] as readonly number[],
      frameRate: 10,
      repeat: -1,
      priority: 20,
    },
    land: {
      key: "davide-v3-land",
      textureKey: ACTOR_ATLAS.player.key,
      frames: [17] as readonly number[],
      frameRate: 18,
      durationMs: 150,
      repeat: 0,
      priority: 40,
      lockUntilComplete: true,
    },
    "fire-up-ground": {
      key: "davide-v3-fire-up-ground",
      textureKey: ACTOR_ATLAS.player.key,
      frames: [18] as readonly number[],
      frameRate: 15,
      repeat: 0,
      priority: 50,
      lockUntilComplete: true,
    },
    "fire-up-air": {
      key: "davide-v3-fire-up-air",
      textureKey: ACTOR_ATLAS.player.key,
      frames: [19] as readonly number[],
      frameRate: 15,
      repeat: 0,
      priority: 50,
      lockUntilComplete: true,
    },
    "fire-diagonal": {
      key: "davide-v3-fire-diagonal",
      textureKey: ACTOR_ATLAS.player.key,
      frames: [20] as readonly number[],
      frameRate: 15,
      repeat: 0,
      priority: 50,
      lockUntilComplete: true,
    },
    hit: {
      key: "davide-v3-hit",
      textureKey: ACTOR_ATLAS.player.key,
      frames: [21] as readonly number[],
      frameRate: 16,
      repeat: 0,
      priority: 80,
      lockUntilComplete: true,
    },
    defeat: {
      key: "davide-v3-defeat",
      textureKey: ACTOR_ATLAS.player.key,
      frames: [22] as readonly number[],
      frameRate: 9,
      durationMs: 520,
      repeat: 0,
      priority: 100,
      lockUntilComplete: true,
    },
    respawn: {
      key: "davide-v3-respawn",
      textureKey: ACTOR_ATLAS.player.key,
      frames: [23] as readonly number[],
      frameRate: 10,
      durationMs: 420,
      repeat: 0,
      priority: 90,
      lockUntilComplete: true,
    },
  },
} as const satisfies {
  display: Readonly<{ width: number; height: number }>;
  pivot: Readonly<{ x: number; y: number }>;
  animations: Record<string, ActorAnimationDefinition>;
};

export type PlayerVisualState = keyof typeof PLAYER_VISUAL.animations;

export const ENEMY_VISUAL = {
  display: { width: 48, height: 48 },
  pivot: { x: 32, y: 58 },
  animations: {
    walker: {
      key: "enemy-v3-walker-move",
      textureKey: ACTOR_ATLAS.enemy.key,
      frames: [0, 1, 2, 3, 4, 5] as readonly number[],
      frameRate: 9,
      repeat: -1,
      priority: 10,
    },
    roller: {
      key: "enemy-v3-roller-move",
      textureKey: ACTOR_ATLAS.enemy.key,
      frames: [6, 7, 8, 9, 10, 11] as readonly number[],
      frameRate: 12,
      repeat: -1,
      priority: 10,
    },
    "sentry-idle": {
      key: "enemy-v3-sentry-idle",
      textureKey: ACTOR_ATLAS.enemy.key,
      frames: [12, 13, 14] as readonly number[],
      frameRate: 5,
      repeat: -1,
      priority: 0,
    },
    "sentry-attack": {
      key: "enemy-v3-sentry-attack",
      textureKey: ACTOR_ATLAS.enemy.key,
      frames: [15, 16, 17] as readonly number[],
      frameRate: 12,
      repeat: 0,
      priority: 50,
      lockUntilComplete: true,
    },
    flyer: {
      key: "enemy-v3-flyer-move",
      textureKey: ACTOR_ATLAS.enemy.key,
      frames: [18, 19, 20, 21, 22, 23] as readonly number[],
      frameRate: 10,
      repeat: -1,
      priority: 10,
    },
  },
} as const satisfies {
  display: Readonly<{ width: number; height: number }>;
  pivot: Readonly<{ x: number; y: number }>;
  animations: Record<string, ActorAnimationDefinition>;
};

export type EnemyVisualState = keyof typeof ENEMY_VISUAL.animations;
export type EnemyVisualKind =
  | "walker"
  | "charger"
  | "sentry"
  | "flyer"
  | "roller"
  | "mimic";
export type EnemyVisualAction = "idle" | "move" | "attack";

const ENEMY_STATE_BY_ACTION: Record<
  EnemyVisualKind,
  Record<EnemyVisualAction, EnemyVisualState>
> = {
  walker: { idle: "walker", move: "walker", attack: "walker" },
  charger: { idle: "walker", move: "walker", attack: "walker" },
  mimic: { idle: "walker", move: "walker", attack: "walker" },
  roller: { idle: "roller", move: "roller", attack: "roller" },
  sentry: {
    idle: "sentry-idle",
    move: "sentry-idle",
    attack: "sentry-attack",
  },
  flyer: { idle: "flyer", move: "flyer", attack: "flyer" },
};

export function getEnemyVisualState(
  kind: EnemyVisualKind,
  action: EnemyVisualAction,
): EnemyVisualState {
  return ENEMY_STATE_BY_ACTION[kind][action];
}

export type BossVisualId = "minotaur" | "pluto" | "charon";
export type BossVisualState = "idle" | "move" | "telegraph" | "attack" | "hit" | "defeat";

const BOSS_FRAME_OFFSET: Record<BossVisualId, number> = {
  minotaur: 0,
  pluto: 6,
  charon: 12,
};

const BOSS_STATE_FRAME: Record<BossVisualState, number> = {
  idle: 0,
  move: 1,
  telegraph: 2,
  attack: 3,
  hit: 4,
  defeat: 5,
};

const BOSS_STATE_PRIORITY: Record<BossVisualState, number> = {
  idle: 0,
  move: 10,
  telegraph: 50,
  attack: 60,
  hit: 80,
  defeat: 100,
};

const BOSS_STATE_DURATION_MS: Record<BossVisualState, number> = {
  idle: 0,
  move: 0,
  telegraph: 400,
  attack: 180,
  hit: 90,
  defeat: 700,
};

function createBossAnimation(
  bossId: BossVisualId,
  state: BossVisualState,
): ActorAnimationDefinition {
  const lockUntilComplete = state !== "idle" && state !== "move";
  const durationMs = BOSS_STATE_DURATION_MS[state];

  return {
    key: `boss-v3-${bossId}-${state}`,
    textureKey: ACTOR_ATLAS.boss.key,
    frames: [BOSS_FRAME_OFFSET[bossId] + BOSS_STATE_FRAME[state]],
    frameRate: 12,
    repeat: lockUntilComplete ? 0 : -1,
    priority: BOSS_STATE_PRIORITY[state],
    ...(lockUntilComplete ? { lockUntilComplete: true } : {}),
    ...(state === "defeat" ? { hideOnComplete: true } : {}),
    ...(durationMs > 0 ? { durationMs } : {}),
  };
}

export const BOSS_VISUAL = {
  display: { width: 96, height: 96 },
  pivot: { x: 32, y: 58 },
  animations: Object.fromEntries(
    (["minotaur", "pluto", "charon"] as const).map((bossId) => [
      bossId,
      Object.fromEntries(
        (["idle", "move", "telegraph", "attack", "hit", "defeat"] as const).map(
          (state) => [state, createBossAnimation(bossId, state)],
        ),
      ),
    ]),
  ) as Record<BossVisualId, Record<BossVisualState, ActorAnimationDefinition>>,
} as const;

export const ACTOR_ANIMATIONS: readonly ActorAnimationDefinition[] = [
  ...Object.values(PLAYER_VISUAL.animations),
  ...Object.values(ENEMY_VISUAL.animations),
  ...Object.values(BOSS_VISUAL.animations).flatMap((animations) =>
    Object.values(animations),
  ),
];

export function getBossAnimation(
  bossId: BossVisualId,
  state: BossVisualState,
): ActorAnimationDefinition {
  return BOSS_VISUAL.animations[bossId][state];
}
