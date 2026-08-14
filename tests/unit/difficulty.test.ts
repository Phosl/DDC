import { describe, expect, it } from "vitest";

import { DIFFICULTY_TUNING } from "../../src/lib/rise-game/difficulty";

describe("difficulty tuning", () => {
  it("keeps Standard accessible and Assistita strictly more forgiving", () => {
    const standard = DIFFICULTY_TUNING.standard;
    const assist = DIFFICULTY_TUNING.assist;

    expect(standard.player).toMatchObject({
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
    });
    expect(standard.platforms).toEqual({
      movingWidth: 80,
      horizontalRange: 48,
      verticalRange: 24,
      horizontalSpeed: 38,
      verticalSpeed: 28,
      oneWayTolerance: 14,
      crumbleDelayMs: 600,
      crumbleRestoreMs: 1_200,
    });
    expect(standard.combat).toEqual({
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
    });
    expect(assist.player).toEqual({
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
    });
    expect(assist.platforms).toEqual({
      movingWidth: 96,
      horizontalRange: 36,
      verticalRange: 16,
      horizontalSpeed: 30,
      verticalSpeed: 22,
      oneWayTolerance: 18,
      crumbleDelayMs: 900,
      crumbleRestoreMs: 900,
    });
    expect(assist.combat).toEqual({
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
    });
    expect(assist.player.coyoteMs).toBeGreaterThan(standard.player.coyoteMs);
    expect(assist.player.maxFallVelocity).toBeLessThan(standard.player.maxFallVelocity);
    expect(assist.combat.shotCost).toBeLessThan(standard.combat.shotCost);
    expect(assist.combat.rechargePerSecond).toBeGreaterThan(
      standard.combat.rechargePerSecond,
    );
    expect(assist.platforms.movingWidth).toBeGreaterThan(
      standard.platforms.movingWidth,
    );
    expect(assist.enemies.speedScale).toBeLessThan(standard.enemies.speedScale);
    expect(assist.respawn.threatClearRadius).toBeGreaterThan(
      standard.respawn.threatClearRadius,
    );
  });

  it("defines the approved boss health curve independently per mode", () => {
    expect(DIFFICULTY_TUNING.standard.bosses.health).toEqual({
      minotaur: 12,
      pluto: 14,
      charon: 16,
    });
    expect(DIFFICULTY_TUNING.assist.bosses.health).toEqual({
      minotaur: 9,
      pluto: 10,
      charon: 12,
    });
  });
});
