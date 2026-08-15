import { describe, expect, it } from "vitest";

import {
  GAME_HEIGHT,
  GAME_WIDTH,
  LEVEL_HEIGHT,
  MAX_GAME_WIDTH,
  resolveAdaptiveHorizontalBounds,
  resolveBackgroundTileTransform,
  resolveRuntimeViewportSize,
  resolveRuntimeWorldGeometry,
} from "../../src/lib/rise-game/config";
import { resolvePointerViewportPoint } from "../../src/lib/rise-game/create-rise-game";

describe("runtime viewport", () => {
  it("keeps the authored portrait viewport outside desktop fullscreen", () => {
    expect(
      resolveRuntimeViewportSize({
        mode: "portrait",
        parentWidth: 1440,
        parentHeight: 900,
      }),
    ).toEqual({ width: GAME_WIDTH, height: GAME_HEIGHT });
  });

  it.each([
    [1366, 650, 1413],
    [1440, 900, 1076],
    [1920, 1080, 1195],
  ])(
    "fills a %ix%i desktop parent with a %i-unit wide logical viewport",
    (parentWidth, parentHeight, expectedWidth) => {
      const viewport = resolveRuntimeViewportSize({
        mode: "adaptive-wide",
        parentWidth,
        parentHeight,
      });

      expect(viewport).toEqual({ width: expectedWidth, height: GAME_HEIGHT });
      expect(Math.abs(viewport.width / viewport.height - parentWidth / parentHeight)).toBeLessThan(
        1 / GAME_HEIGHT,
      );
    },
  );

  it("never narrows the playfield and caps pathological ultra-wide canvases", () => {
    expect(
      resolveRuntimeViewportSize({
        mode: "adaptive-wide",
        parentWidth: 360,
        parentHeight: 900,
      }).width,
    ).toBe(GAME_WIDTH);
    expect(
      resolveRuntimeViewportSize({
        mode: "adaptive-wide",
        parentWidth: 10_000,
        parentHeight: 400,
      }).width,
    ).toBe(MAX_GAME_WIDTH);
  });

  it("falls back safely while the parent has no measurable size", () => {
    expect(
      resolveRuntimeViewportSize({
        mode: "adaptive-wide",
        parentWidth: 0,
        parentHeight: Number.NaN,
      }),
    ).toEqual({ width: GAME_WIDTH, height: GAME_HEIGHT });
  });

  it("maps CSS mouse coordinates into the current logical viewport", () => {
    expect(
      resolvePointerViewportPoint({
        clientX: 740,
        clientY: 500,
        canvasLeft: 20,
        canvasTop: 50,
        canvasWidth: 1_440,
        canvasHeight: 900,
        viewportWidth: 1_076,
        viewportHeight: GAME_HEIGHT,
      }),
    ).toEqual({ x: 538, y: GAME_HEIGHT / 2 });

    expect(
      resolvePointerViewportPoint({
        clientX: 0,
        clientY: 0,
        canvasLeft: 20,
        canvasTop: 50,
        canvasWidth: 1_440,
        canvasHeight: 900,
        viewportWidth: 1_076,
        viewportHeight: GAME_HEIGHT,
      }),
    ).toBeNull();
  });

  it("centers the authored map inside physical wide-world bounds", () => {
    expect(resolveRuntimeWorldGeometry(GAME_WIDTH)).toEqual({
      left: 0,
      right: GAME_WIDTH,
      width: GAME_WIDTH,
      mapLeft: 0,
      mapRight: GAME_WIDTH,
      mapOffsetX: 0,
    });

    expect(resolveRuntimeWorldGeometry(1_076)).toEqual({
      left: -346,
      right: 730,
      width: 1_076,
      mapLeft: 0,
      mapRight: GAME_WIDTH,
      mapOffsetX: 346,
    });
  });

  it("moves walls and stretches floor edges when the viewport resizes", () => {
    const portrait = resolveRuntimeWorldGeometry(GAME_WIDTH);
    const wide = resolveRuntimeWorldGeometry(1_076);

    expect(
      resolveAdaptiveHorizontalBounds({
        role: "pin-left",
        authoredLeft: 0,
        authoredRight: 16,
        geometry: portrait,
      }),
    ).toEqual({ left: 0, right: 16, width: 16, centerX: 8 });
    expect(
      resolveAdaptiveHorizontalBounds({
        role: "pin-left",
        authoredLeft: 0,
        authoredRight: 16,
        geometry: wide,
      }),
    ).toEqual({ left: -346, right: -330, width: 16, centerX: -338 });
    expect(
      resolveAdaptiveHorizontalBounds({
        role: "extend-right",
        authoredLeft: 240,
        authoredRight: GAME_WIDTH,
        geometry: wide,
      }),
    ).toEqual({ left: 240, right: 730, width: 490, centerX: 485 });
    expect(
      resolveAdaptiveHorizontalBounds({
        role: "fill",
        authoredLeft: 0,
        authoredRight: GAME_WIDTH,
        geometry: wide,
      }),
    ).toEqual({ left: -346, right: 730, width: 1_076, centerX: GAME_WIDTH / 2 });
  });

  it("keeps portrait backgrounds unchanged and cover-crops wide backgrounds uniformly", () => {
    expect(
      resolveBackgroundTileTransform({
        viewportWidth: GAME_WIDTH,
        textureWidth: 768,
        textureHeight: 291,
      }),
    ).toEqual({ scaleX: 0.5, scaleY: 0.5, positionX: 0, positionY: 0 });

    const wide = resolveBackgroundTileTransform({
      viewportWidth: 1_076,
      textureWidth: 768,
      textureHeight: 291,
    });
    expect(wide.scaleX).toBeCloseTo(wide.scaleY);
    expect(wide.scaleX).toBeCloseTo(LEVEL_HEIGHT / 291);
    expect(1_076 / wide.scaleX).toBeLessThanOrEqual(768);
    expect(LEVEL_HEIGHT / wide.scaleY).toBeLessThanOrEqual(291);
    expect(wide.positionX).toBeGreaterThan(0);
    expect(wide.positionY).toBeCloseTo(0);
  });
});
