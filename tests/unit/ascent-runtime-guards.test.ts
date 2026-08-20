import { describe, expect, it } from "vitest";

import {
  canReleaseTimedAttack,
  isDirectionalVerseAngle,
  resolveStablePlatformPosition,
  resolveSourceHitbox,
  resolveVerseHitbox,
  resolvePointerAimVector,
  resolveAimFacingDirection,
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
    expect(resolveAimFacingDirection({ x: -0.8, y: 0.2 }, 160, false)).toBe(-1);
    expect(resolveAimFacingDirection({ x: 0.8, y: 0.2 }, -160, true)).toBe(1);
    expect(resolveAimFacingDirection({ x: 0.05, y: -1 }, -160, false)).toBe(-1);
  });

  it("aims from the Verse socket through the camera viewport", () => {
    const aim = resolvePointerAimVector({
      viewportX: 768,
      viewportY: 200,
      cameraScrollX: -480,
      cameraScrollY: 8_000,
      originX: 192,
      originY: 8_272,
    });

    expect(aim?.x).toBeCloseTo(0.8, 5);
    expect(aim?.y).toBeCloseTo(-0.6, 5);
    expect(
      resolvePointerAimVector({
        viewportX: 672,
        viewportY: 272,
        cameraScrollX: -480,
        cameraScrollY: 8_000,
        originX: 192,
        originY: 8_272,
      }),
    ).toBeNull();
    expect(
      resolvePointerAimVector({
        viewportX: Number.NaN,
        viewportY: 0,
        cameraScrollX: 0,
        cameraScrollY: 0,
        originX: 0,
        originY: 0,
      }),
    ).toBeNull();
  });

  it("rotates the Verse collision box with vertical and diagonal shots", () => {
    const vertical = resolveVerseHitbox(-90, true);
    expect(vertical.width).toBeCloseTo(8, 5);
    expect(vertical.height).toBeCloseTo(16, 5);
    const diagonal = resolveVerseHitbox(-55, true);
    expect(diagonal.width).toBeCloseTo(15.73, 1);
    expect(diagonal.height).toBeCloseTo(17.7, 1);
    expect(resolveVerseHitbox(-90, false)).toEqual({ width: 7, height: 14 });
    expect(resolveVerseHitbox(0, false)).toEqual({ width: 14, height: 7 });
    const downLeft = resolveVerseHitbox(135, false);
    expect(downLeft.width).toBeCloseTo(14.85, 1);
    expect(downLeft.height).toBeCloseTo(14.85, 1);
  });

  it("uses the directional firing pose for horizontal and downward aim", () => {
    expect(isDirectionalVerseAngle(-90)).toBe(false);
    expect(isDirectionalVerseAngle(-84)).toBe(false);
    expect(isDirectionalVerseAngle(0)).toBe(true);
    expect(isDirectionalVerseAngle(90)).toBe(true);
    expect(isDirectionalVerseAngle(180)).toBe(true);
  });

  it("converts the authored sprite scale into a real 22x32 world hitbox", () => {
    const source = resolveSourceHitbox(22, 32, 0.75, 1);
    expect(source).toEqual({ width: 22 / 0.75, height: 32 });
    expect(source.width * 0.75).toBeCloseTo(22);
    expect(source.height).toBe(32);
  });

  it("keeps source-space hitbox geometry stable when touch actors are doubled", () => {
    const standard = resolveSourceHitbox(22, 32, 0.75, 1);
    const touch = resolveSourceHitbox(44, 64, 1.5, 2);

    expect(touch).toEqual(standard);
    expect(touch.width * 1.5).toBeCloseTo(44);
    expect(touch.height * 2).toBeCloseTo(64);
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

  it("keeps assisted respawns inside resized wide-world bounds", () => {
    const leftSide = resolveStablePlatformPosition({
      platformX: -300,
      platformY: 500,
      platformLeft: -346,
      platformRight: -240,
      offsetX: -70,
      offsetY: -34,
      playerWidth: 22,
      worldWidth: 1_076,
      worldLeft: -346,
    });

    expect(leftSide).toEqual({ x: -322, y: 466 });
  });
});
