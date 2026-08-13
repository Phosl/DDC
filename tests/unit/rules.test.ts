import { describe, expect, it } from "vitest";

import { CIRCLE_LEVELS } from "../../src/lib/rise-game/level-data";
import {
  EMPTY_BEST_TIMES,
  INITIAL_JUMP_WINDOW_STATE,
  INITIAL_RUN_PROGRESS,
  advanceMovingPlatform,
  advanceRunTimer,
  consumeInputEdges,
  consumeLife,
  mergeGameInput,
  reachActCheckpoint,
  resolveJumpFrame,
  restartRunProgress,
  shouldCollideOneWay,
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
      jumpHeld: true,
      fireHeld: true,
      jumpPressed: false,
      firePressed: false,
      pausePressed: false,
    });
    expect(input.jumpPressed).toBe(true);
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
