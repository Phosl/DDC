import { describe, expect, it } from "vitest";

import {
  canReleaseTimedAttack,
  resolveStablePlatformPosition,
  resolveSourceHitbox,
  resolveVerseHitbox,
  resolveFacingDirection,
} from "../../src/lib/rise-game/ascent-scene";

describe("ascent timed attack guards", () => {
  const readyAttack = {
    actorActive: true,
    defeated: false,
    hp: 1,
    bodyEnabled: true,
    phase: "playing" as const,
  };

  it("releases an attack only while its living physics actor is playable", () => {
    expect(canReleaseTimedAttack(readyAttack)).toBe(true);
    expect(canReleaseTimedAttack({ ...readyAttack, actorActive: false })).toBe(false);
    expect(canReleaseTimedAttack({ ...readyAttack, defeated: true })).toBe(false);
    expect(canReleaseTimedAttack({ ...readyAttack, hp: 0 })).toBe(false);
    expect(canReleaseTimedAttack({ ...readyAttack, bodyEnabled: false })).toBe(false);
    expect(canReleaseTimedAttack({ ...readyAttack, phase: "paused" })).toBe(false);
  });

  it("keeps the last facing direction when firing from rest", () => {
    expect(resolveFacingDirection(160, true)).toBe(1);
    expect(resolveFacingDirection(-160, false)).toBe(-1);
    expect(resolveFacingDirection(0, true)).toBe(-1);
    expect(resolveFacingDirection(0, false)).toBe(1);
  });

  it("rotates the Verse collision box with vertical and diagonal shots", () => {
    const vertical = resolveVerseHitbox(-90, true);
    expect(vertical.width).toBeCloseTo(8, 5);
    expect(vertical.height).toBeCloseTo(16, 5);
    const diagonal = resolveVerseHitbox(-55, true);
    expect(diagonal.width).toBeCloseTo(15.73, 1);
    expect(diagonal.height).toBeCloseTo(17.7, 1);
    expect(resolveVerseHitbox(-90, false)).toEqual({ width: 7, height: 14 });
  });

  it("converts the authored sprite scale into a real 22x32 world hitbox", () => {
    const source = resolveSourceHitbox(22, 32, 0.75, 1);
    expect(source).toEqual({ width: 22 / 0.75, height: 32 });
    expect(source.width * 0.75).toBeCloseTo(22);
    expect(source.height).toBe(32);
  });

  it("anchors an assisted respawn to the platform current position", () => {
    const first = resolveStablePlatformPosition({
      platformX: 120,
      platformY: 500,
      platformLeft: 80,
      platformRight: 160,
      offsetX: 18,
      offsetY: -34,
      playerWidth: 22,
      worldWidth: 384,
    });
    const moved = resolveStablePlatformPosition({
      platformX: 156,
      platformY: 476,
      platformLeft: 116,
      platformRight: 196,
      offsetX: 18,
      offsetY: -34,
      playerWidth: 22,
      worldWidth: 384,
    });

    expect(first).toEqual({ x: 138, y: 466 });
    expect(moved).toEqual({ x: 174, y: 442 });
    expect(moved.x - first.x).toBe(36);
    expect(moved.y - first.y).toBe(-24);
  });
});
