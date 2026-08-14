import { describe, expect, it } from "vitest";

import {
  NEUTRAL_GAMEPAD_FRAME,
  areGamepadControlFramesEqual,
  readStandardGamepadFrame,
  type GamepadButtonLike,
  type StandardGamepadLike,
} from "../../src/lib/rise-game/gamepad-input";

function makeButtons(
  pressed: Readonly<Record<number, GamepadButtonLike>> = {},
): GamepadButtonLike[] {
  return Array.from({ length: 16 }, (_, index) => pressed[index] ?? { value: 0 });
}

function makeGamepad(
  patch: Partial<StandardGamepadLike> = {},
): StandardGamepadLike {
  return {
    axes: [0, 0, 0, 0],
    buttons: makeButtons(),
    connected: true,
    mapping: "standard",
    ...patch,
  };
}

describe("standard gamepad input", () => {
  it("returns a neutral frame for missing, disconnected or unsupported pads", () => {
    expect(readStandardGamepadFrame(null)).toBe(NEUTRAL_GAMEPAD_FRAME);
    expect(readStandardGamepadFrame(makeGamepad({ connected: false }))).toBe(
      NEUTRAL_GAMEPAD_FRAME,
    );
    expect(readStandardGamepadFrame(makeGamepad({ mapping: "custom" }))).toBe(
      NEUTRAL_GAMEPAD_FRAME,
    );
  });

  it("maps movement, right-stick aim, jump, trigger and Start", () => {
    const frame = readStandardGamepadFrame(
      makeGamepad({
        axes: [0.8, 0, 0.6, -0.8],
        buttons: makeButtons({
          0: { pressed: true },
          7: { value: 0.4 },
          9: { pressed: true },
        }),
      }),
    );

    expect(frame).toEqual({
      moveX: 1,
      aim: { x: 0.6, y: -0.8 },
      jumpHeld: true,
      fireHeld: true,
      pauseHeld: true,
    });
  });

  it("uses a radial aim dead zone and does not fire from trigger noise", () => {
    const frame = readStandardGamepadFrame(
      makeGamepad({
        axes: [0.2, 0, 0.12, -0.12],
        buttons: makeButtons({ 7: { value: 0.2 } }),
      }),
    );

    expect(frame).toEqual(NEUTRAL_GAMEPAD_FRAME);
  });

  it("lets the D-pad override the movement axis and supports RB fire", () => {
    const left = readStandardGamepadFrame(
      makeGamepad({
        axes: [0.9, 0, 0, 0],
        buttons: makeButtons({
          5: { pressed: true },
          14: { pressed: true },
        }),
      }),
    );
    const opposed = readStandardGamepadFrame(
      makeGamepad({
        axes: [-0.9, 0, 0, 0],
        buttons: makeButtons({
          14: { pressed: true },
          15: { pressed: true },
        }),
      }),
    );

    expect(left).toMatchObject({ moveX: -1, fireHeld: true });
    expect(opposed.moveX).toBe(0);
  });

  it("compares complete frames, including their normalized aim", () => {
    const first = readStandardGamepadFrame(makeGamepad({ axes: [0, 0, 1, 0] }));
    const same = readStandardGamepadFrame(makeGamepad({ axes: [0, 0, 0.8, 0] }));
    const changed = readStandardGamepadFrame(makeGamepad({ axes: [0, 0, 0, -1] }));

    expect(areGamepadControlFramesEqual(first, same)).toBe(true);
    expect(areGamepadControlFramesEqual(first, changed)).toBe(false);
  });
});
