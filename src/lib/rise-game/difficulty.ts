import type { BossId } from "./level-data";

export type DifficultyMode = "standard" | "assist";

export type DifficultyEnemyKind =
  | "walker"
  | "charger"
  | "sentry"
  | "flyer"
  | "roller"
  | "mimic";

export type DifficultyTuning = Readonly<{
  player: Readonly<{
    width: number;
    height: number;
    speed: number;
    gravity: number;
    jumpVelocity: number;
    maxFallVelocity: number;
    coyoteMs: number;
    jumpBufferMs: number;
    jumpCutMultiplier: number;
    invulnerableMs: number;
  }>;
  mechanics: Readonly<{
    stickySpeedScale: number;
    iceResponsiveness: number;
    windForce: number;
    knockbackForce: number;
    rainForce: number;
  }>;
  platforms: Readonly<{
    movingWidth: number;
    horizontalRange: number;
    verticalRange: number;
    horizontalSpeed: number;
    verticalSpeed: number;
    oneWayTolerance: number;
    crumbleDelayMs: number;
    crumbleRestoreMs: number;
  }>;
  combat: Readonly<{
    maxBreath: number;
    shotCost: number;
    fireIntervalMs: number;
    rechargeDelayMs: number;
    rechargePerSecond: number;
    rimaDurationMs: number;
    projectileSpeed: number;
    projectileLifetimeMs: number;
    maxProjectiles: number;
    voiceBreathRestore: number;
    emptyBreathFeedbackMs: number;
  }>;
  enemies: Readonly<{
    speedScale: number;
    engagementDistance: number;
    health: Readonly<Record<DifficultyEnemyKind, number>>;
    sentry: Readonly<{
      firstAttackDelayMs: number;
      intervalMs: number;
      windupMs: number;
      projectileSpeed: number;
    }>;
  }>;
  bosses: Readonly<{
    health: Readonly<Record<BossId, number>>;
    engagementDistance: number;
    firstAttackDelayMs: number;
    telegraphMs: number;
    phaseTransitionDelayMs: number;
    phaseCooldownMs: readonly [number, number, number];
    phaseProjectileSpeed: readonly [number, number, number];
    phaseTravel: readonly [number, number, number];
  }>;
  respawn: Readonly<{
    minimumBreath: number;
    threatClearRadius: number;
  }>;
}>;

export const DIFFICULTY_TUNING = {
  standard: {
    player: {
      width: 22,
      height: 32,
      speed: 170,
      gravity: 1_000,
      jumpVelocity: -440,
      maxFallVelocity: 520,
      coyoteMs: 140,
      jumpBufferMs: 160,
      jumpCutMultiplier: 0.75,
      invulnerableMs: 1_600,
    },
    mechanics: {
      stickySpeedScale: 0.78,
      iceResponsiveness: 0.13,
      windForce: 12,
      knockbackForce: 6,
      rainForce: 0.034,
    },
    platforms: {
      movingWidth: 80,
      horizontalRange: 48,
      verticalRange: 24,
      horizontalSpeed: 38,
      verticalSpeed: 28,
      oneWayTolerance: 14,
      crumbleDelayMs: 600,
      crumbleRestoreMs: 1_200,
    },
    combat: {
      maxBreath: 100,
      shotCost: 10,
      fireIntervalMs: 180,
      rechargeDelayMs: 250,
      rechargePerSecond: 36,
      rimaDurationMs: 9_000,
      projectileSpeed: 460,
      projectileLifetimeMs: 1_500,
      maxProjectiles: 24,
      voiceBreathRestore: 8,
      emptyBreathFeedbackMs: 1_200,
    },
    enemies: {
      speedScale: 0.82,
      engagementDistance: 300,
      health: {
        walker: 1,
        charger: 2,
        sentry: 2,
        flyer: 1,
        roller: 2,
        mimic: 1,
      },
      sentry: {
        firstAttackDelayMs: 800,
        intervalMs: 1_600,
        windupMs: 450,
        projectileSpeed: 120,
      },
    },
    bosses: {
      health: { minotaur: 12, pluto: 14, charon: 16 },
      engagementDistance: 180,
      firstAttackDelayMs: 1_000,
      telegraphMs: 650,
      phaseTransitionDelayMs: 700,
      phaseCooldownMs: [1_500, 1_350, 1_200],
      phaseProjectileSpeed: [135, 145, 155],
      phaseTravel: [35, 55, 75],
    },
    respawn: {
      minimumBreath: 60,
      threatClearRadius: 160,
    },
  },
  assist: {
    player: {
      width: 22,
      height: 32,
      speed: 180,
      gravity: 900,
      jumpVelocity: -455,
      maxFallVelocity: 460,
      coyoteMs: 200,
      jumpBufferMs: 220,
      jumpCutMultiplier: 0.78,
      invulnerableMs: 2_400,
    },
    mechanics: {
      stickySpeedScale: 0.86,
      iceResponsiveness: 0.2,
      windForce: 6,
      knockbackForce: 3,
      rainForce: 0.012,
    },
    platforms: {
      movingWidth: 96,
      horizontalRange: 36,
      verticalRange: 16,
      horizontalSpeed: 30,
      verticalSpeed: 22,
      oneWayTolerance: 18,
      crumbleDelayMs: 900,
      crumbleRestoreMs: 900,
    },
    combat: {
      maxBreath: 100,
      shotCost: 8,
      fireIntervalMs: 160,
      rechargeDelayMs: 180,
      rechargePerSecond: 48,
      rimaDurationMs: 12_000,
      projectileSpeed: 480,
      projectileLifetimeMs: 1_700,
      maxProjectiles: 24,
      voiceBreathRestore: 8,
      emptyBreathFeedbackMs: 1_200,
    },
    enemies: {
      speedScale: 0.6,
      engagementDistance: 240,
      health: {
        walker: 1,
        charger: 1,
        sentry: 1,
        flyer: 1,
        roller: 1,
        mimic: 1,
      },
      sentry: {
        firstAttackDelayMs: 1_200,
        intervalMs: 2_200,
        windupMs: 600,
        projectileSpeed: 95,
      },
    },
    bosses: {
      health: { minotaur: 9, pluto: 10, charon: 12 },
      engagementDistance: 140,
      firstAttackDelayMs: 1_400,
      telegraphMs: 800,
      phaseTransitionDelayMs: 850,
      phaseCooldownMs: [2_200, 2_000, 1_800],
      phaseProjectileSpeed: [100, 110, 120],
      phaseTravel: [24, 38, 52],
    },
    respawn: {
      minimumBreath: 75,
      threatClearRadius: 220,
    },
  },
} as const satisfies Record<DifficultyMode, DifficultyTuning>;

export function getDifficultyTuning(assist: boolean): DifficultyTuning {
  return assist ? DIFFICULTY_TUNING.assist : DIFFICULTY_TUNING.standard;
}
