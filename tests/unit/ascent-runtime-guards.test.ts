import { describe, expect, it } from "vitest";

import {
  canReleaseTimedAttack,
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
});
