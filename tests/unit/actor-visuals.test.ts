import { describe, expect, it, vi } from "vitest";

import {
  createActorVisualController,
  type ActorAnimationDriver,
} from "../../src/lib/rise-game/visuals/actor-visuals";
import {
  ACTOR_ANIMATIONS,
  ACTOR_ATLAS,
  BOSS_VISUAL,
  ENEMY_VISUAL,
  PLAYER_VISUAL,
  getBossAnimation,
  getEnemyVisualState,
  type ActorAnimationDefinition,
} from "../../src/lib/rise-game/visuals/visual-manifest";

type TestState = "idle" | "run" | "jump" | "fall" | "land" | "hit" | "defeat";

const definition = (
  state: TestState,
  priority: number,
  lockUntilComplete = false,
  hideOnComplete = false,
): ActorAnimationDefinition => ({
  key: `test-${state}`,
  textureKey: ACTOR_ATLAS.player.key,
  frames: [0],
  frameRate: 12,
  repeat: lockUntilComplete ? 0 : -1,
  priority,
  ...(lockUntilComplete ? { lockUntilComplete: true } : {}),
  ...(hideOnComplete ? { hideOnComplete: true } : {}),
});

const DEFINITIONS: Record<TestState, ActorAnimationDefinition> = {
  idle: definition("idle", 0),
  run: definition("run", 10),
  jump: definition("jump", 30, true),
  fall: definition("fall", 20),
  land: definition("land", 40, true),
  hit: definition("hit", 80, true),
  defeat: definition("defeat", 100, true, true),
};

function createDriverHarness() {
  const completions: Array<() => void> = [];
  const played: string[] = [];
  const visible: boolean[] = [];
  const cancelled: string[] = [];
  const driver: ActorAnimationDriver = {
    play(next, onComplete) {
      played.push(next.key);
      completions.push(onComplete);
      return () => cancelled.push(next.key);
    },
    setVisible(value) {
      visible.push(value);
    },
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(),
  };
  return { driver, completions, played, visible, cancelled };
}

describe("actor visual manifest", () => {
  it("uses compact 6 by 4 actor atlases with 64 pixel cells", () => {
    expect(Object.values(ACTOR_ATLAS)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          frameWidth: 64,
          frameHeight: 64,
          columns: 6,
          rows: 4,
        }),
      ]),
    );
    expect(Object.values(ACTOR_ATLAS)).toHaveLength(3);
    expect(PLAYER_VISUAL).toMatchObject({
      display: { width: 48, height: 64 },
      pivot: { x: 32, y: 58 },
    });
  });

  it("maps every aligned production frame once and keeps the agreed action order", () => {
    const frames = Object.values(PLAYER_VISUAL.animations).flatMap((animation) => [
      ...animation.frames,
    ]);

    expect(frames).toEqual([...Array(24).keys()].filter((frame) => frame !== 12 && frame !== 15));
    expect(PLAYER_VISUAL.animations.idle.frames).toEqual([0, 1]);
    expect(PLAYER_VISUAL.animations.run.frames).toEqual([2, 3, 4, 5]);
    expect(PLAYER_VISUAL.animations["jump-start"].frames).toEqual([6, 7]);
    expect(PLAYER_VISUAL.animations["jump-start"].priority).toBeGreaterThan(
      PLAYER_VISUAL.animations.land.priority,
    );
    expect(PLAYER_VISUAL.animations.jump.frames).toEqual([8, 9]);
    expect(PLAYER_VISUAL.animations.fall.frames).toEqual([10]);
    expect(PLAYER_VISUAL.animations.land.frames).toEqual([11]);
    expect(PLAYER_VISUAL.animations["fire-up-ground"].frames).toEqual([13]);
    expect(PLAYER_VISUAL.animations["fire-up-air"].frames).toEqual([14]);
    expect(PLAYER_VISUAL.animations["fire-diagonal"].frames).toEqual([16, 17]);
    expect(PLAYER_VISUAL.animations.hit.frames).toEqual([18, 19]);
    expect(PLAYER_VISUAL.animations.defeat.frames).toEqual([20, 21]);
    expect(PLAYER_VISUAL.animations.respawn.frames).toEqual([22, 23]);
  });

  it("keeps enemy family rows and boss single-frame states explicit", () => {
    expect(ENEMY_VISUAL.animations.walker.frames).toEqual([0, 1, 2, 3, 4, 5]);
    expect(ENEMY_VISUAL.animations.roller.frames).toEqual([6, 7, 8, 9, 10, 11]);
    expect(ENEMY_VISUAL.animations["sentry-idle"].frames).toEqual([12, 13, 14]);
    expect(ENEMY_VISUAL.animations["sentry-attack"].frames).toEqual([15, 16, 17]);
    expect(ENEMY_VISUAL.animations.flyer.frames).toEqual([18, 19, 20, 21, 22, 23]);
    expect(getEnemyVisualState("charger", "move")).toBe("walker");
    expect(getEnemyVisualState("sentry", "attack")).toBe("sentry-attack");
    expect(getBossAnimation("minotaur", "attack").frames).toEqual([3]);
    expect(getBossAnimation("pluto", "attack").frames).toEqual([9]);
    expect(getBossAnimation("charon", "defeat").frames).toEqual([17]);
    expect(BOSS_VISUAL.animations.charon.defeat.hideOnComplete).toBe(true);
    expect(new Set(ACTOR_ANIMATIONS.map(({ key }) => key)).size).toBe(
      ACTOR_ANIMATIONS.length,
    );
  });
});

describe("actor visual controller", () => {
  it("does not restart a current or just-completed jump", () => {
    const harness = createDriverHarness();
    const controller = createActorVisualController<TestState>({
      definitions: DEFINITIONS,
      fallbackState: "idle",
      driver: harness.driver,
    });

    expect(controller.play("jump")).toBe("started");
    expect(controller.play("jump")).toBe("already-current");
    expect(harness.played).toEqual(["test-jump"]);

    harness.completions[0]();
    expect(controller.current()).toBe("idle");
    expect(controller.play("jump")).toBe("latched");
    expect(harness.played).toEqual(["test-jump", "test-idle"]);

    expect(controller.play("fall")).toBe("started");
  });

  it("queues locomotion behind a one-shot and lets hit preempt it", () => {
    const harness = createDriverHarness();
    const controller = createActorVisualController<TestState>({
      definitions: DEFINITIONS,
      fallbackState: "idle",
      driver: harness.driver,
    });

    expect(controller.play("land")).toBe("started");
    expect(controller.play("run")).toBe("queued");
    expect(controller.play("hit")).toBe("started");
    expect(harness.cancelled).toContain("test-land");
    expect(harness.played).toEqual(["test-land", "test-hit"]);

    harness.completions[1]();
    expect(controller.current()).toBe("run");
    expect(harness.played.at(-1)).toBe("test-run");
  });

  it("keeps a completed one-shot latched while a queued fallback starts", () => {
    const harness = createDriverHarness();
    const controller = createActorVisualController<TestState>({
      definitions: DEFINITIONS,
      fallbackState: "idle",
      driver: harness.driver,
    });

    expect(controller.play("land")).toBe("started");
    expect(controller.play("run")).toBe("queued");
    harness.completions[0]();

    expect(controller.current()).toBe("run");
    expect(controller.play("land")).toBe("latched");
    expect(harness.played).toEqual(["test-land", "test-run"]);

    expect(controller.play("run")).toBe("already-current");
    expect(controller.play("land")).toBe("started");
  });

  it("re-arms a one-shot after the caller confirms its fallback state", () => {
    const harness = createDriverHarness();
    const controller = createActorVisualController<TestState>({
      definitions: DEFINITIONS,
      fallbackState: "idle",
      driver: harness.driver,
    });

    expect(controller.play("jump")).toBe("started");
    harness.completions[0]();
    expect(controller.play("jump")).toBe("latched");
    expect(controller.play("idle")).toBe("already-current");
    expect(controller.play("jump")).toBe("started");
  });

  it("makes defeat terminal, invokes completion, and resets explicitly", () => {
    const harness = createDriverHarness();
    const onComplete = vi.fn();
    const controller = createActorVisualController<TestState>({
      definitions: DEFINITIONS,
      fallbackState: "idle",
      driver: harness.driver,
    });

    expect(controller.play("defeat", { onComplete })).toBe("started");
    expect(controller.play("hit")).toBe("terminal");
    expect(harness.played).toEqual(["test-defeat"]);
    harness.completions[0]();

    expect(onComplete).toHaveBeenCalledOnce();
    expect(harness.visible.at(-1)).toBe(false);
    expect(controller.play("idle")).toBe("terminal");

    controller.reset("idle");
    expect(controller.current()).toBe("idle");
    expect(harness.visible.at(-1)).toBe(true);
  });

  it("cleans playback once and ignores commands after destroy", () => {
    const harness = createDriverHarness();
    const controller = createActorVisualController<TestState>({
      definitions: DEFINITIONS,
      fallbackState: "idle",
      driver: harness.driver,
    });

    controller.play("jump");
    controller.pause();
    controller.resume();
    controller.destroy();
    controller.destroy();

    expect(harness.driver.pause).toHaveBeenCalledOnce();
    expect(harness.driver.resume).toHaveBeenCalledOnce();
    expect(harness.driver.stop).toHaveBeenCalledOnce();
    expect(controller.play("idle")).toBe("destroyed");
  });
});
