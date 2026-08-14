import { describe, expect, it } from "vitest";

import { CIRCLE_LEVELS } from "../../src/lib/rise-game/level-data";
import { DIFFICULTY_TUNING } from "../../src/lib/rise-game/difficulty";
import {
  EMPTY_BEST_TIMES,
  INITIAL_JUMP_WINDOW_STATE,
  INITIAL_RUN_PROGRESS,
  advanceMovingPlatform,
  advanceRunTimer,
  consumeInputEdges,
  consumeLife,
  isWithinVerticalViewport,
  mergeGameInput,
  normalizeAimVector,
  recoverBreath,
  reachActCheckpoint,
  resolveJumpFrame,
  resolveVerseTrajectory,
  restartRunProgress,
  shouldCollideOneWay,
  spendBreath,
  restoreBreath,
  submitBestTime,
  simulateCampaignRun,
} from "../../src/lib/rise-game/rules";
import { INITIAL_GAME_INPUT } from "../../src/lib/rise-game/types";

describe("input rules", () => {
  it("merges held controls while latching short-lived input edges", () => {
    const initial = { ...INITIAL_GAME_INPUT };
    const pressed = mergeGameInput(initial, {
      moveX: 1,
      jumpPressed: true,
      jumpHeld: true,
      firePressed: true,
    });
    const releasedBeforeTick = mergeGameInput(pressed, {
      moveX: 0,
      jumpPressed: false,
      jumpHeld: false,
      firePressed: false,
    });

    expect(initial).toEqual(INITIAL_GAME_INPUT);
    expect(releasedBeforeTick).toMatchObject({
      moveX: 0,
      aim: null,
      jumpHeld: false,
      jumpPressed: true,
      firePressed: true,
    });
  });

  it("consumes every edge once without changing held controls", () => {
    const input = mergeGameInput(INITIAL_GAME_INPUT, {
      moveX: -1,
      jumpHeld: true,
      fireHeld: true,
      jumpPressed: true,
      firePressed: true,
      pausePressed: true,
    });
    const consumed = consumeInputEdges(input);

    expect(consumed.edges).toEqual({
      jumpPressed: true,
      firePressed: true,
      pausePressed: true,
    });
    expect(consumed.next).toEqual({
      moveX: -1,
      aim: null,
      jumpHeld: true,
      fireHeld: true,
      jumpPressed: false,
      firePressed: false,
      pausePressed: false,
    });
    expect(input.jumpPressed).toBe(true);
  });

  it("normalizes an aim patch atomically and clears it back to keyboard fallback", () => {
    const aimed = mergeGameInput(INITIAL_GAME_INPUT, {
      aim: { x: 3, y: -4 },
    });
    const cleared = mergeGameInput(aimed, { aim: null });

    expect(aimed.aim).toEqual({ x: 0.6, y: -0.8 });
    expect(cleared.aim).toBeNull();
    expect(normalizeAimVector({ x: 0.1, y: -0.1 })).toBeNull();
    expect(INITIAL_GAME_INPUT.aim).toBeNull();
  });
});

describe("jump rules", () => {
  const tuning = {
    coyoteMs: 100,
    jumpBufferMs: 120,
    jumpVelocity: -420,
  } as const;

  it("allows a coyote jump during the grace window and rejects it afterwards", () => {
    const state = {
      ...INITIAL_JUMP_WINDOW_STATE,
      lastGroundedAtMs: 1_000,
    };
    const inside = resolveJumpFrame({
      ...tuning,
      state,
      nowMs: 1_100,
      grounded: false,
      jumpPressed: true,
      jumpHeld: true,
      velocityY: 80,
    });
    const outside = resolveJumpFrame({
      ...tuning,
      state,
      nowMs: 1_101,
      grounded: false,
      jumpPressed: true,
      jumpHeld: true,
      velocityY: 80,
    });

    expect(inside).toMatchObject({ jumped: true, velocityY: -420 });
    expect(outside).toMatchObject({ jumped: false, velocityY: 80 });
  });

  it("buffers a press before landing and spends it on the first grounded frame", () => {
    const buffered = resolveJumpFrame({
      ...tuning,
      state: INITIAL_JUMP_WINDOW_STATE,
      nowMs: 2_000,
      grounded: false,
      jumpPressed: true,
      jumpHeld: true,
      velocityY: 150,
    });
    const landed = resolveJumpFrame({
      ...tuning,
      state: buffered.state,
      nowMs: 2_120,
      grounded: true,
      jumpPressed: false,
      jumpHeld: true,
      velocityY: 0,
    });

    expect(buffered.jumped).toBe(false);
    expect(buffered.state.jumpBufferedAtMs).toBe(2_000);
    expect(landed).toMatchObject({ jumped: true, velocityY: -420 });
    expect(landed.state.jumpBufferedAtMs).toBeNull();
  });

  it("cuts upward velocity once when jump is released", () => {
    const released = resolveJumpFrame({
      ...tuning,
      state: INITIAL_JUMP_WINDOW_STATE,
      nowMs: 3_000,
      grounded: false,
      jumpPressed: false,
      jumpHeld: false,
      velocityY: -360,
    });
    const nextFrame = resolveJumpFrame({
      ...tuning,
      state: released.state,
      nowMs: 3_016,
      grounded: false,
      jumpPressed: false,
      jumpHeld: false,
      velocityY: -170,
    });

    expect(released).toMatchObject({ cut: true, velocityY: -180 });
    expect(nextFrame).toMatchObject({ cut: false, velocityY: -170 });
  });

  it("keeps both accessible profiles above their authored route rises", () => {
    const standard = DIFFICULTY_TUNING.standard.player;
    const assist = DIFFICULTY_TUNING.assist.player;
    const fullRise = (velocity: number, gravity: number) =>
      (velocity * velocity) / (2 * gravity);

    expect(fullRise(standard.jumpVelocity, standard.gravity)).toBeGreaterThan(64);
    expect(
      fullRise(
        standard.jumpVelocity * standard.jumpCutMultiplier,
        standard.gravity,
      ),
    ).toBeGreaterThan(48);
    expect(fullRise(assist.jumpVelocity, assist.gravity)).toBeGreaterThan(96);
  });
});

describe("Verse and FIATO rules", () => {
  it("fires vertically without direction and diagonally from held input", () => {
    const vertical = resolveVerseTrajectory({
      moveX: 0,
      facingDirection: -1,
      projectileSpeed: 460,
    });
    const diagonal = resolveVerseTrajectory({
      moveX: 1,
      facingDirection: -1,
      projectileSpeed: 460,
    });

    expect(vertical).toMatchObject({ diagonal: false, angleDegrees: -90 });
    expect(vertical.velocityX).toBeCloseTo(0, 8);
    expect(diagonal).toMatchObject({
      diagonal: true,
      direction: 1,
      angleDegrees: -55,
    });
    expect(diagonal.velocityX).toBeGreaterThan(0);
    expect(diagonal.velocityY).toBeLessThan(0);
  });

  it.each([
    ["right", { x: 1, y: 0 }, 0, 1],
    ["down-right", { x: 1, y: 1 }, 45, 1],
    ["down", { x: 0, y: 1 }, 90, -1],
    ["down-left", { x: -1, y: 1 }, 135, -1],
    ["left", { x: -1, y: 0 }, 180, -1],
    ["up-left", { x: -1, y: -1 }, -135, -1],
    ["up", { x: 0, y: -1 }, -90, -1],
    ["up-right", { x: 1, y: -1 }, -45, 1],
  ] as const)("resolves %s as a constant-speed 360-degree trajectory", (_name, aim, angle, direction) => {
    const trajectory = resolveVerseTrajectory({
      moveX: 0,
      facingDirection: -1,
      projectileSpeed: 460,
      aim,
    });

    expect(trajectory.angleDegrees).toBeCloseTo(angle, 8);
    expect(trajectory.direction).toBe(direction);
    expect(Math.hypot(trajectory.velocityX, trajectory.velocityY)).toBeCloseTo(460, 8);
  });

  it("keeps contextual keyboard aim when a stick is neutral or inside its dead zone", () => {
    const neutral = resolveVerseTrajectory({
      moveX: -1,
      facingDirection: 1,
      projectileSpeed: 460,
      aim: null,
    });
    const noisyStick = resolveVerseTrajectory({
      moveX: -1,
      facingDirection: 1,
      projectileSpeed: 460,
      aim: { x: 0.1, y: -0.1 },
    });

    expect(neutral).toMatchObject({ angleDegrees: -125, direction: -1 });
    expect(noisyStick).toEqual(neutral);
  });

  it("spends, delays, recovers and caps FIATO deterministically", () => {
    expect(spendBreath(10, 10)).toEqual({ breath: 0, spent: true });
    expect(spendBreath(9, 10)).toEqual({ breath: 9, spent: false });
    expect(
      recoverBreath({
        breath: 20,
        maxBreath: 100,
        lastShotAtMs: 1_000,
        nowMs: 1_200,
        deltaMs: 100,
        rechargeDelayMs: 250,
        rechargePerSecond: 36,
      }),
    ).toBe(20);
    expect(
      recoverBreath({
        breath: 20,
        maxBreath: 100,
        lastShotAtMs: 1_000,
        nowMs: 1_300,
        deltaMs: 100,
        rechargeDelayMs: 250,
        rechargePerSecond: 36,
      }),
    ).toBeCloseTo(23.6);
    expect(restoreBreath(96, 8, 100)).toBe(100);
  });

  it("engages an actor only inside the visible vertical viewport", () => {
    expect(
      isWithinVerticalViewport({ actorY: 500, scrollY: 100, viewportHeight: 672 }),
    ).toBe(true);
    expect(
      isWithinVerticalViewport({ actorY: 90, scrollY: 100, viewportHeight: 672 }),
    ).toBe(false);
  });
});

describe("platform rules", () => {
  it("accepts one-way landings from above and rejects rising or underneath actors", () => {
    expect(
      shouldCollideOneWay({ actorBottom: 108, actorVelocityY: 70, platformTop: 100 }),
    ).toBe(true);
    expect(
      shouldCollideOneWay({ actorBottom: 108, actorVelocityY: -70, platformTop: 100 }),
    ).toBe(false);
    expect(
      shouldCollideOneWay({ actorBottom: 116, actorVelocityY: 70, platformTop: 100 }),
    ).toBe(false);
    expect(
      shouldCollideOneWay({
        actorBottom: 108,
        actorVelocityY: 20,
        platformTop: 100,
        platformVelocityY: 30,
      }),
    ).toBe(false);
    expect(
      shouldCollideOneWay({
        actorBottom: 117,
        actorVelocityY: 70,
        platformTop: 100,
        tolerance: DIFFICULTY_TUNING.assist.platforms.oneWayTolerance,
      }),
    ).toBe(true);
  });

  it("moves at units per second and reflects cleanly at both endpoints", () => {
    const initial = { position: 100, origin: 100, direction: 1 as const, range: 20, speed: 10 };
    const first = advanceMovingPlatform(initial, 1_000);
    const reflected = advanceMovingPlatform(first, 2_000);
    const fullCycle = advanceMovingPlatform(initial, 8_000);

    expect(first).toMatchObject({ position: 110, direction: 1 });
    expect(reflected).toMatchObject({ position: 110, direction: -1 });
    expect(fullCycle).toEqual(initial);
    expect(initial.position).toBe(100);
  });
});

describe("run, checkpoint and record rules", () => {
  it("advances the timer only while playing and never moves it backwards", () => {
    const playing = advanceRunTimer(INITIAL_RUN_PROGRESS, 16.67, true);
    const paused = advanceRunTimer(playing, 500, false);
    const invalid = advanceRunTimer(paused, -100, true);

    expect(playing.elapsedMs).toBeCloseTo(16.67);
    expect(paused).toBe(playing);
    expect(invalid).toBe(paused);
  });

  it("keeps checkpoints monotonic and consumes exactly one life per hit", () => {
    const atActTwo = reachActCheckpoint(INITIAL_RUN_PROGRESS, 1);
    const cannotRegress = reachActCheckpoint(atActTwo, 0);
    const firstHit = consumeLife(atActTwo);
    const secondHit = consumeLife(firstHit.state);
    const finalHit = consumeLife(secondHit.state);

    expect(atActTwo.checkpointActIndex).toBe(1);
    expect(cannotRegress).toBe(atActTwo);
    expect(firstHit).toMatchObject({ state: { lives: 2 }, gameOver: false });
    expect(finalHit).toMatchObject({ state: { lives: 0 }, gameOver: true });
  });

  it("continues from the Act with time intact but permanently disables the record", () => {
    const run = {
      elapsedMs: 42_500,
      lives: 0,
      checkpointActIndex: 2 as const,
      recordEligible: true,
    };

    expect(restartRunProgress(run, "continue-act")).toEqual({
      elapsedMs: 42_500,
      lives: 3,
      checkpointActIndex: 2,
      recordEligible: false,
    });
    expect(restartRunProgress(run, "full-run")).toEqual(INITIAL_RUN_PROGRESS);
  });

  it("stores Standard and Assistita best times in independent buckets", () => {
    const standard = submitBestTime(EMPTY_BEST_TIMES, {
      assist: false,
      elapsedMs: 210_000.4,
      recordEligible: true,
    });
    const assisted = submitBestTime(standard.bestTimes, {
      assist: true,
      elapsedMs: 240_000,
      recordEligible: true,
    });
    const slowerStandard = submitBestTime(assisted.bestTimes, {
      assist: false,
      elapsedMs: 220_000,
      recordEligible: true,
    });
    const continued = submitBestTime(assisted.bestTimes, {
      assist: true,
      elapsedMs: 180_000,
      recordEligible: false,
    });

    expect(standard).toEqual({
      bestTimes: { standard: 210_000, assist: null },
      isRecord: true,
    });
    expect(assisted).toEqual({
      bestTimes: { standard: 210_000, assist: 240_000 },
      isRecord: true,
    });
    expect(slowerStandard).toEqual({ bestTimes: assisted.bestTimes, isRecord: false });
    expect(continued).toEqual({ bestTimes: assisted.bestTimes, isRecord: false });
    expect(EMPTY_BEST_TIMES).toEqual({ standard: null, assist: null });
  });

  it("proves a complete campaign from circle IX to I through all custodians", () => {
    const result = simulateCampaignRun(
      CIRCLE_LEVELS.map((level) => ({
        circleId: level.id,
        actIndex: level.actIndex,
        checkpoint: level.checkpoint,
        bossId: level.boss,
      })),
    );

    expect(result).toEqual({
      visitedCircles: ["IX", "VIII", "VII", "VI", "V", "IV", "III", "II", "I"],
      defeatedBosses: ["minotaur", "pluto", "charon"],
      checkpointActIndex: 2,
      complete: true,
    });
  });
});
