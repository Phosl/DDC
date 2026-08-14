import { DEFAULT_AIM_DEADZONE, normalizeAimVector } from "./rules";
import type { AimVector } from "./types";

export const DEFAULT_GAMEPAD_AIM_DEADZONE = DEFAULT_AIM_DEADZONE;
export const DEFAULT_GAMEPAD_MOVE_DEADZONE = 0.35;
export const DEFAULT_GAMEPAD_TRIGGER_THRESHOLD = 0.25;

export type GamepadButtonLike = Readonly<{
  pressed?: boolean;
  value?: number;
}>;

export type StandardGamepadLike = Readonly<{
  axes: ReadonlyArray<number>;
  buttons: ReadonlyArray<GamepadButtonLike>;
  connected?: boolean;
  mapping?: string;
}>;

export type GamepadControlFrame = Readonly<{
  moveX: -1 | 0 | 1;
  aim: AimVector | null;
  jumpHeld: boolean;
  fireHeld: boolean;
  pauseHeld: boolean;
}>;

export const NEUTRAL_GAMEPAD_FRAME: Readonly<GamepadControlFrame> = Object.freeze({
  moveX: 0,
  aim: null,
  jumpHeld: false,
  fireHeld: false,
  pauseHeld: false,
});

function safeAxis(axes: ReadonlyArray<number>, index: number) {
  const value = axes[index];
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

function buttonValue(buttons: ReadonlyArray<GamepadButtonLike>, index: number) {
  const button = buttons[index];
  if (!button) return 0;
  if (button.pressed) return 1;
  return Number.isFinite(button.value) ? Math.max(0, Math.min(1, button.value ?? 0)) : 0;
}

type ReadStandardGamepadOptions = Readonly<{
  aimDeadzone?: number;
  moveDeadzone?: number;
  triggerThreshold?: number;
}>;

/** Maps the browser's standard layout without depending on DOM Gamepad types. */
export function readStandardGamepadFrame(
  gamepad: StandardGamepadLike | null | undefined,
  {
    aimDeadzone = DEFAULT_GAMEPAD_AIM_DEADZONE,
    moveDeadzone = DEFAULT_GAMEPAD_MOVE_DEADZONE,
    triggerThreshold = DEFAULT_GAMEPAD_TRIGGER_THRESHOLD,
  }: ReadStandardGamepadOptions = {},
): GamepadControlFrame {
  if (!gamepad || gamepad.connected === false) return NEUTRAL_GAMEPAD_FRAME;
  if (gamepad.mapping && gamepad.mapping !== "standard") return NEUTRAL_GAMEPAD_FRAME;

  const safeMoveDeadzone = Number.isFinite(moveDeadzone)
    ? Math.max(0, Math.min(1, moveDeadzone))
    : DEFAULT_GAMEPAD_MOVE_DEADZONE;
  const horizontalAxis = safeAxis(gamepad.axes, 0);
  const dpadLeft = buttonValue(gamepad.buttons, 14) > 0.5;
  const dpadRight = buttonValue(gamepad.buttons, 15) > 0.5;
  let moveX: -1 | 0 | 1 =
    Math.abs(horizontalAxis) > safeMoveDeadzone ? (horizontalAxis < 0 ? -1 : 1) : 0;

  if (dpadLeft !== dpadRight) moveX = dpadLeft ? -1 : 1;
  if (dpadLeft && dpadRight) moveX = 0;

  const safeTriggerThreshold = Number.isFinite(triggerThreshold)
    ? Math.max(0, Math.min(1, triggerThreshold))
    : DEFAULT_GAMEPAD_TRIGGER_THRESHOLD;

  return {
    moveX,
    aim: normalizeAimVector(
      { x: safeAxis(gamepad.axes, 2), y: safeAxis(gamepad.axes, 3) },
      aimDeadzone,
    ),
    jumpHeld: buttonValue(gamepad.buttons, 0) > 0.5,
    fireHeld:
      buttonValue(gamepad.buttons, 7) > safeTriggerThreshold ||
      buttonValue(gamepad.buttons, 5) > 0.5,
    pauseHeld: buttonValue(gamepad.buttons, 9) > 0.5,
  };
}

export function areGamepadControlFramesEqual(
  left: Readonly<GamepadControlFrame>,
  right: Readonly<GamepadControlFrame>,
) {
  return (
    left.moveX === right.moveX &&
    left.jumpHeld === right.jumpHeld &&
    left.fireHeld === right.fireHeld &&
    left.pauseHeld === right.pauseHeld &&
    left.aim?.x === right.aim?.x &&
    left.aim?.y === right.aim?.y
  );
}
