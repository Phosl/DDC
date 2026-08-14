import type Phaser from "phaser";

export const CANTICA_VFX_ATLAS = {
  key: "cantica-vfx-atlas",
  path: "/game/v3/effects/cantica-vfx-atlas.png",
  frameWidth: 64,
  frameHeight: 64,
  frameCount: 24,
} as const;

export const VFX_POOL_LIMIT = 48;

export const CANTICA_VFX_FRAMES = {
  verseMuzzle: [0],
  verseProjectile: [1, 2, 1, 3],
  verseTrail: [2, 3],
  verseImpact: [6, 4, 7, 5],
  playerHit: [8, 11],
  shieldBreak: [9, 8, 6],
  noiseProjectile: [10, 10, 6, 10],
  noiseImpact: [6, 11],
  landingSoft: [12, 14],
  landingHard: [12, 13, 14],
  pickup: [15, 5],
  playerRespawn: [16, 17, 22],
  enemyDissolve: [18, 19, 20],
  bossTelegraph: [9, 10],
  bossBurst: [23, 21, 20],
} as const;

export type VfxKind =
  | "verse-muzzle"
  | "verse-trail"
  | "verse-impact"
  | "noise-impact"
  | "enemy-hit"
  | "enemy-dissolve"
  | "player-hit"
  | "player-respawn"
  | "shield-break"
  | "landing-soft"
  | "landing-hard"
  | "pickup"
  | "boss-telegraph"
  | "boss-burst";

export type VfxProjectileKind = "verse" | "noise";

export type VfxAttachment = Readonly<{
  x: number;
  y: number;
  active?: boolean;
  flipX?: boolean;
}>;

export type VfxPlayOptions = Readonly<{
  offsetX?: number;
  offsetY?: number;
  rotation?: number;
  flipX?: boolean;
  followFlipX?: boolean;
  scale?: number;
  depth?: number;
  tint?: number;
  onComplete?: () => void;
}>;

export type VfxHandle = Readonly<{
  readonly active: boolean;
  stop: () => void;
}>;

export type ProjectileVisualRecipe = Readonly<{
  textureKey: string;
  frame?: number;
  usesAtlas: boolean;
  recommendedDisplaySize: Readonly<{ width: number; height: number }>;
  /** Rotation added when the source art must be aligned with its velocity. */
  rotationOffset: number;
  trail: VfxKind | null;
  impact: VfxKind;
}>;

export type ProjectileVisualTarget = {
  setTexture(texture: string, frame?: string | number): unknown;
};

export interface CanticaVfxSystem {
  playWorld(
    kind: VfxKind,
    x: number,
    y: number,
    options?: VfxPlayOptions,
  ): VfxHandle | null;
  playAttached(
    kind: VfxKind,
    target: VfxAttachment,
    options?: VfxPlayOptions,
  ): VfxHandle | null;
  getProjectileVisual(kind: VfxProjectileKind, ageMs?: number): ProjectileVisualRecipe | null;
  applyProjectileVisual(
    target: ProjectileVisualTarget,
    kind: VfxProjectileKind,
    ageMs?: number,
  ): ProjectileVisualRecipe | null;
  update(deltaMs: number): void;
  pause(): void;
  resume(): void;
  setReducedMotion(enabled: boolean): void;
  destroy(): void;
}

type EffectSpec = Readonly<{
  frames: readonly number[];
  durationMs: number;
  reducedMotionFrame: number;
  reducedMotionDurationMs: number;
  suppressInReducedMotion?: boolean;
  fallbackTexture: string;
  fallbackTint?: number;
  baseScale: number;
  fallbackScale: number;
  scaleFrom: number;
  scaleTo: number;
  originX: number;
  originY: number;
  depth: number;
  priority: 1 | 2 | 3;
}>;

const EFFECT_SPECS: Record<VfxKind, EffectSpec> = {
  "verse-muzzle": {
    frames: CANTICA_VFX_FRAMES.verseMuzzle,
    durationMs: 110,
    reducedMotionFrame: 0,
    reducedMotionDurationMs: 90,
    fallbackTexture: "verse-projectile",
    fallbackTint: 0xffffff,
    baseScale: 0.72,
    fallbackScale: 1.6,
    scaleFrom: 0.68,
    scaleTo: 1,
    originX: 0.5,
    originY: 0.5,
    depth: 14,
    priority: 2,
  },
  "verse-trail": {
    frames: CANTICA_VFX_FRAMES.verseTrail,
    durationMs: 120,
    reducedMotionFrame: 3,
    reducedMotionDurationMs: 0,
    suppressInReducedMotion: true,
    fallbackTexture: "verse-projectile",
    fallbackTint: 0x39f4ff,
    baseScale: 0.5,
    fallbackScale: 0.8,
    scaleFrom: 0.72,
    scaleTo: 1,
    originX: 0.5,
    originY: 0.5,
    depth: 10,
    priority: 1,
  },
  "verse-impact": {
    frames: CANTICA_VFX_FRAMES.verseImpact,
    durationMs: 260,
    reducedMotionFrame: 4,
    reducedMotionDurationMs: 130,
    fallbackTexture: "verse-projectile",
    fallbackTint: 0xffffff,
    baseScale: 0.92,
    fallbackScale: 2.4,
    scaleFrom: 0.72,
    scaleTo: 1.08,
    originX: 0.5,
    originY: 0.5,
    depth: 14,
    priority: 3,
  },
  "noise-impact": {
    frames: CANTICA_VFX_FRAMES.noiseImpact,
    durationMs: 170,
    reducedMotionFrame: 11,
    reducedMotionDurationMs: 120,
    fallbackTexture: "noise-projectile",
    fallbackTint: 0xff664f,
    baseScale: 0.7,
    fallbackScale: 1.8,
    scaleFrom: 0.7,
    scaleTo: 1,
    originX: 0.5,
    originY: 0.5,
    depth: 13,
    priority: 2,
  },
  "enemy-hit": {
    frames: CANTICA_VFX_FRAMES.noiseImpact,
    durationMs: 170,
    reducedMotionFrame: 11,
    reducedMotionDurationMs: 120,
    fallbackTexture: "noise-projectile",
    fallbackTint: 0xff4f73,
    baseScale: 0.68,
    fallbackScale: 1.7,
    scaleFrom: 0.72,
    scaleTo: 1,
    originX: 0.5,
    originY: 0.5,
    depth: 13,
    priority: 2,
  },
  "enemy-dissolve": {
    frames: CANTICA_VFX_FRAMES.enemyDissolve,
    durationMs: 430,
    reducedMotionFrame: 20,
    reducedMotionDurationMs: 180,
    fallbackTexture: "noise-projectile",
    fallbackTint: 0xff4f73,
    baseScale: 0.9,
    fallbackScale: 2.2,
    scaleFrom: 0.9,
    scaleTo: 1.12,
    originX: 0.5,
    originY: 0.5,
    depth: 13,
    priority: 3,
  },
  "player-hit": {
    frames: CANTICA_VFX_FRAMES.playerHit,
    durationMs: 220,
    reducedMotionFrame: 8,
    reducedMotionDurationMs: 140,
    fallbackTexture: "noise-projectile",
    fallbackTint: 0xff4f73,
    baseScale: 0.95,
    fallbackScale: 2.2,
    scaleFrom: 0.74,
    scaleTo: 1.04,
    originX: 0.5,
    originY: 0.5,
    depth: 15,
    priority: 3,
  },
  "player-respawn": {
    frames: CANTICA_VFX_FRAMES.playerRespawn,
    durationMs: 480,
    reducedMotionFrame: 16,
    reducedMotionDurationMs: 180,
    fallbackTexture: "pickup-light",
    fallbackTint: 0x39f4ff,
    baseScale: 1.08,
    fallbackScale: 2.5,
    scaleFrom: 0.82,
    scaleTo: 1,
    originX: 0.5,
    originY: 0.72,
    depth: 14,
    priority: 3,
  },
  "shield-break": {
    frames: CANTICA_VFX_FRAMES.shieldBreak,
    durationMs: 260,
    reducedMotionFrame: 9,
    reducedMotionDurationMs: 150,
    fallbackTexture: "pickup-light",
    fallbackTint: 0xffd166,
    baseScale: 0.92,
    fallbackScale: 2.2,
    scaleFrom: 0.72,
    scaleTo: 1.12,
    originX: 0.5,
    originY: 0.5,
    depth: 15,
    priority: 3,
  },
  "landing-soft": {
    frames: CANTICA_VFX_FRAMES.landingSoft,
    durationMs: 170,
    reducedMotionFrame: 12,
    reducedMotionDurationMs: 100,
    fallbackTexture: "noise-projectile",
    fallbackTint: 0xf4f0e8,
    baseScale: 0.72,
    fallbackScale: 1.6,
    scaleFrom: 0.72,
    scaleTo: 1.06,
    originX: 0.5,
    originY: 0.88,
    depth: 11,
    priority: 1,
  },
  "landing-hard": {
    frames: CANTICA_VFX_FRAMES.landingHard,
    durationMs: 260,
    reducedMotionFrame: 13,
    reducedMotionDurationMs: 120,
    fallbackTexture: "noise-projectile",
    fallbackTint: 0xf4f0e8,
    baseScale: 0.98,
    fallbackScale: 2,
    scaleFrom: 0.66,
    scaleTo: 1.12,
    originX: 0.5,
    originY: 0.88,
    depth: 11,
    priority: 2,
  },
  pickup: {
    frames: CANTICA_VFX_FRAMES.pickup,
    durationMs: 230,
    reducedMotionFrame: 15,
    reducedMotionDurationMs: 130,
    fallbackTexture: "pickup-voice",
    fallbackTint: 0x39f4ff,
    baseScale: 0.8,
    fallbackScale: 1.8,
    scaleFrom: 0.68,
    scaleTo: 1.08,
    originX: 0.5,
    originY: 0.5,
    depth: 14,
    priority: 2,
  },
  "boss-telegraph": {
    frames: CANTICA_VFX_FRAMES.bossTelegraph,
    durationMs: 400,
    reducedMotionFrame: 9,
    reducedMotionDurationMs: 170,
    fallbackTexture: "pickup-light",
    fallbackTint: 0xffd166,
    baseScale: 1.2,
    fallbackScale: 2.8,
    scaleFrom: 0.78,
    scaleTo: 1.08,
    originX: 0.5,
    originY: 0.62,
    depth: 7,
    priority: 2,
  },
  "boss-burst": {
    frames: CANTICA_VFX_FRAMES.bossBurst,
    durationMs: 700,
    reducedMotionFrame: 23,
    reducedMotionDurationMs: 220,
    fallbackTexture: "noise-projectile",
    fallbackTint: 0xffffff,
    baseScale: 1.55,
    fallbackScale: 3.4,
    scaleFrom: 0.68,
    scaleTo: 1.28,
    originX: 0.5,
    originY: 0.5,
    depth: 15,
    priority: 3,
  },
};

type VfxSlot = {
  sprite: Phaser.GameObjects.Sprite;
  active: boolean;
  token: number;
  kind: VfxKind;
  spec: EffectSpec;
  frames: readonly number[];
  elapsedMs: number;
  durationMs: number;
  attachment: VfxAttachment | null;
  offsetX: number;
  offsetY: number;
  followFlipX: boolean;
  scale: number;
  atlas: boolean;
  onComplete?: () => void;
};

const isFiniteNumber = (value: number) => Number.isFinite(value);

export function preloadCanticaVfxAtlas(scene: Phaser.Scene) {
  if (scene.textures.exists(CANTICA_VFX_ATLAS.key)) return;
  scene.load.spritesheet(CANTICA_VFX_ATLAS.key, CANTICA_VFX_ATLAS.path, {
    frameWidth: CANTICA_VFX_ATLAS.frameWidth,
    frameHeight: CANTICA_VFX_ATLAS.frameHeight,
    endFrame: CANTICA_VFX_ATLAS.frameCount - 1,
  });
}

export function createCanticaVfxSystem(
  scene: Phaser.Scene,
  options: Readonly<{ reducedMotion?: boolean; poolLimit?: number }> = {},
): CanticaVfxSystem {
  const requestedPoolLimit = options.poolLimit ?? VFX_POOL_LIMIT;
  const poolLimit = Number.isFinite(requestedPoolLimit)
    ? Math.max(1, Math.min(VFX_POOL_LIMIT, Math.floor(requestedPoolLimit)))
    : VFX_POOL_LIMIT;
  const slots: VfxSlot[] = [];
  let reducedMotion = Boolean(options.reducedMotion);
  let paused = false;
  let destroyed = false;
  let nextToken = 1;

  const release = (slot: VfxSlot, completed = false) => {
    if (!slot.active) return;
    const onComplete = completed ? slot.onComplete : undefined;
    slot.active = false;
    slot.attachment = null;
    slot.onComplete = undefined;
    slot.sprite
      .setActive(false)
      .setVisible(false)
      .setAlpha(1)
      .setScale(1)
      .setRotation(0)
      .setFlipX(false)
      .clearTint();
    onComplete?.();
  };

  const chooseTexture = (spec: EffectSpec) => {
    if (scene.textures.exists(CANTICA_VFX_ATLAS.key)) {
      return { key: CANTICA_VFX_ATLAS.key, atlas: true } as const;
    }
    if (scene.textures.exists(spec.fallbackTexture)) {
      return { key: spec.fallbackTexture, atlas: false } as const;
    }
    return null;
  };

  const acquire = (spec: EffectSpec) => {
    const texture = chooseTexture(spec);
    if (!texture) return null;

    let slot = slots.find((candidate) => !candidate.active);
    if (!slot && slots.length < poolLimit) {
      const sprite = scene.add.sprite(0, 0, texture.key, texture.atlas ? spec.frames[0] : undefined);
      sprite.setActive(false).setVisible(false);
      slot = {
        sprite,
        active: false,
        token: 0,
        kind: "verse-impact",
        spec,
        frames: spec.frames,
        elapsedMs: 0,
        durationMs: spec.durationMs,
        attachment: null,
        offsetX: 0,
        offsetY: 0,
        followFlipX: false,
        scale: 1,
        atlas: texture.atlas,
      };
      slots.push(slot);
    }
    if (!slot) {
      slot = slots
        .filter((candidate) => candidate.active && candidate.spec.priority <= spec.priority)
        .sort((a, b) => b.elapsedMs / b.durationMs - a.elapsedMs / a.durationMs)[0];
      if (!slot) return null;
      release(slot);
    }

    slot.atlas = texture.atlas;
    slot.sprite.setTexture(texture.key, texture.atlas ? spec.frames[0] : undefined);
    return slot;
  };

  const positionAttached = (slot: VfxSlot) => {
    const target = slot.attachment;
    if (!target) return true;
    if (target.active === false) return false;
    const mirrored = slot.followFlipX && Boolean(target.flipX);
    slot.sprite.setPosition(target.x + slot.offsetX * (mirrored ? -1 : 1), target.y + slot.offsetY);
    if (slot.followFlipX) slot.sprite.setFlipX(mirrored);
    return true;
  };

  const play = (
    kind: VfxKind,
    x: number,
    y: number,
    attachment: VfxAttachment | null,
    playOptions: VfxPlayOptions = {},
  ): VfxHandle | null => {
    if (destroyed || !isFiniteNumber(x) || !isFiniteNumber(y)) return null;
    const spec = EFFECT_SPECS[kind];
    if (reducedMotion && spec.suppressInReducedMotion) return null;
    const slot = acquire(spec);
    if (!slot) return null;

    const frames = reducedMotion ? [spec.reducedMotionFrame] : spec.frames;
    slot.active = true;
    slot.token = nextToken;
    nextToken += 1;
    slot.kind = kind;
    slot.spec = spec;
    slot.frames = frames;
    slot.elapsedMs = 0;
    slot.durationMs = reducedMotion ? spec.reducedMotionDurationMs : spec.durationMs;
    slot.attachment = attachment;
    slot.offsetX = playOptions.offsetX ?? 0;
    slot.offsetY = playOptions.offsetY ?? 0;
    slot.followFlipX = playOptions.followFlipX ?? false;
    slot.scale = playOptions.scale ?? 1;
    slot.onComplete = playOptions.onComplete;

    const displayScale = slot.scale * (slot.atlas ? spec.baseScale : spec.fallbackScale);
    slot.sprite
      .setPosition(x, y)
      .setOrigin(spec.originX, spec.originY)
      .setDepth(playOptions.depth ?? spec.depth)
      .setRotation(playOptions.rotation ?? 0)
      .setFlipX(playOptions.flipX ?? false)
      .setScale(displayScale * (reducedMotion ? 1 : spec.scaleFrom))
      .setAlpha(1)
      .setActive(true)
      .setVisible(true)
      .clearTint();
    if (!slot.atlas && (playOptions.tint ?? spec.fallbackTint) !== undefined) {
      slot.sprite.setTint(playOptions.tint ?? spec.fallbackTint);
    } else if (playOptions.tint !== undefined) {
      slot.sprite.setTint(playOptions.tint);
    }
    if (slot.atlas) slot.sprite.setFrame(frames[0]);
    if (!positionAttached(slot)) {
      release(slot);
      return null;
    }

    const token = slot.token;
    return {
      get active() {
        return !destroyed && slot.active && slot.token === token;
      },
      stop: () => {
        if (slot.active && slot.token === token) release(slot);
      },
    };
  };

  const getProjectileVisual = (
    kind: VfxProjectileKind,
    ageMs = 0,
  ): ProjectileVisualRecipe | null => {
    if (destroyed) return null;
    const usesAtlas = scene.textures.exists(CANTICA_VFX_ATLAS.key);
    const fallback = kind === "verse" ? "verse-projectile" : "noise-projectile";
    if (!usesAtlas && !scene.textures.exists(fallback)) return null;

    if (!usesAtlas) {
      return {
        textureKey: fallback,
        usesAtlas: false,
        recommendedDisplaySize: kind === "verse" ? { width: 7, height: 17 } : { width: 9, height: 9 },
        rotationOffset: kind === "verse" ? Math.PI / 2 : 0,
        trail: null,
        impact: kind === "verse" ? "verse-impact" : "noise-impact",
      };
    }

    const sequence = kind === "verse" ? CANTICA_VFX_FRAMES.verseProjectile : CANTICA_VFX_FRAMES.noiseProjectile;
    const frameDurationMs = kind === "verse" ? 56 : 84;
    const safeAge = Math.max(0, isFiniteNumber(ageMs) ? ageMs : 0);
    const frame = reducedMotion
      ? sequence[0]
      : sequence[Math.floor(safeAge / frameDurationMs) % sequence.length];
    return {
      textureKey: CANTICA_VFX_ATLAS.key,
      frame,
      usesAtlas: true,
      recommendedDisplaySize: kind === "verse" ? { width: 24, height: 14 } : { width: 18, height: 14 },
      rotationOffset: 0,
      trail: reducedMotion || kind === "noise" ? null : "verse-trail",
      impact: kind === "verse" ? "verse-impact" : "noise-impact",
    };
  };

  const api: CanticaVfxSystem = {
    playWorld: (kind, x, y, playOptions) => play(kind, x, y, null, playOptions),
    playAttached: (kind, target, playOptions) =>
      play(kind, target.x, target.y, target, playOptions),
    getProjectileVisual,
    applyProjectileVisual: (target, kind, ageMs = 0) => {
      if (destroyed) return null;
      const recipe = getProjectileVisual(kind, ageMs);
      if (!recipe) return null;
      if (recipe.frame === undefined) target.setTexture(recipe.textureKey);
      else target.setTexture(recipe.textureKey, recipe.frame);
      return recipe;
    },
    update: (deltaMs) => {
      if (destroyed || paused || !isFiniteNumber(deltaMs) || deltaMs <= 0) return;
      slots.forEach((slot) => {
        if (!slot.active) return;
        if (!positionAttached(slot)) {
          release(slot);
          return;
        }

        slot.elapsedMs += deltaMs;
        if (slot.elapsedMs >= slot.durationMs) {
          release(slot, true);
          return;
        }

        const progress = Math.min(1, slot.elapsedMs / slot.durationMs);
        if (slot.atlas && slot.frames.length > 1) {
          const frameIndex = Math.min(slot.frames.length - 1, Math.floor(progress * slot.frames.length));
          slot.sprite.setFrame(slot.frames[frameIndex]);
        }
        if (!reducedMotion) {
          const spec = slot.spec;
          const displayScale = slot.scale * (slot.atlas ? spec.baseScale : spec.fallbackScale);
          slot.sprite.setScale(displayScale * (spec.scaleFrom + (spec.scaleTo - spec.scaleFrom) * progress));
          slot.sprite.setAlpha(progress < 0.62 ? 1 : 1 - (progress - 0.62) / 0.38);
        }
      });
    },
    pause: () => {
      if (!destroyed) paused = true;
    },
    resume: () => {
      if (!destroyed) paused = false;
    },
    setReducedMotion: (enabled) => {
      if (destroyed || reducedMotion === enabled) return;
      reducedMotion = enabled;
      if (!enabled) return;
      slots.forEach((slot) => {
        if (!slot.active) return;
        if (slot.spec.suppressInReducedMotion) {
          release(slot);
          return;
        }
        slot.frames = [slot.spec.reducedMotionFrame];
        slot.elapsedMs = 0;
        slot.durationMs = slot.spec.reducedMotionDurationMs;
        if (slot.atlas) slot.sprite.setFrame(slot.spec.reducedMotionFrame);
        const displayScale = slot.scale * (slot.atlas ? slot.spec.baseScale : slot.spec.fallbackScale);
        slot.sprite.setScale(displayScale).setAlpha(1);
      });
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      paused = true;
      slots.forEach((slot) => {
        slot.active = false;
        slot.attachment = null;
        slot.onComplete = undefined;
        slot.sprite.destroy();
      });
      slots.length = 0;
    },
  };

  return api;
}
