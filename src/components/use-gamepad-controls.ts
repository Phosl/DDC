"use client";

import { useEffect, useRef } from "react";

import {
  NEUTRAL_GAMEPAD_FRAME,
  areGamepadControlFramesEqual,
  readStandardGamepadFrame,
  type AimVector,
} from "@/lib/rise-game";

type GamepadControlsOptions = Readonly<{
  enabled: boolean;
  onAimChange: (aim: AimVector | null, fireHeld: boolean) => void;
  onConnectionChange: (connected: boolean) => void;
  onJumpChange: (held: boolean) => void;
  onMoveChange: (moveX: -1 | 0 | 1) => void;
  onPauseToggle: () => void;
}>;

function isGameplayNeutral(
  frame: ReturnType<typeof readStandardGamepadFrame>,
) {
  return (
    frame.moveX === 0 &&
    frame.aim === null &&
    !frame.jumpHeld &&
    !frame.fireHeld
  );
}

export function useGamepadControls(options: GamepadControlsOptions) {
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    if (!("getGamepads" in navigator)) return;

    let animationFrame = 0;
    let activeGamepadIndex: number | null = null;
    let previousFrame = NEUTRAL_GAMEPAD_FRAME;
    let previousPauseHeld = false;
    let waitingForNeutral = true;
    let wasConnected = false;
    let wasEnabled = optionsRef.current.enabled;

    const releaseGameplay = () => {
      const handlers = optionsRef.current;
      handlers.onMoveChange(0);
      handlers.onJumpChange(false);
      handlers.onAimChange(null, false);
      previousFrame = NEUTRAL_GAMEPAD_FRAME;
    };

    const readFirstStandardGamepad = () => {
      const pads = navigator.getGamepads();
      for (const pad of pads) {
        if (pad?.connected && pad.mapping === "standard") return pad;
      }
      return null;
    };

    const tick = () => {
      const handlers = optionsRef.current;
      const gamepad = readFirstStandardGamepad();
      const connected = gamepad !== null;

      if (connected !== wasConnected) {
        handlers.onConnectionChange(connected);
        wasConnected = connected;
      }

      if (!gamepad) {
        if (activeGamepadIndex !== null) releaseGameplay();
        activeGamepadIndex = null;
        previousPauseHeld = false;
        waitingForNeutral = true;
        animationFrame = window.requestAnimationFrame(tick);
        return;
      }

      if (gamepad.index !== activeGamepadIndex) {
        releaseGameplay();
        activeGamepadIndex = gamepad.index;
        previousPauseHeld = false;
        waitingForNeutral = true;
      }

      const frame = readStandardGamepadFrame(gamepad);

      const pausePressed = frame.pauseHeld && !previousPauseHeld;
      if (pausePressed) {
        handlers.onPauseToggle();
      }
      previousPauseHeld = frame.pauseHeld;

      if (pausePressed) {
        releaseGameplay();
        waitingForNeutral = true;
        wasEnabled = handlers.enabled;
        animationFrame = window.requestAnimationFrame(tick);
        return;
      }

      if (!handlers.enabled) {
        if (wasEnabled || !areGamepadControlFramesEqual(previousFrame, NEUTRAL_GAMEPAD_FRAME)) {
          releaseGameplay();
        }
        waitingForNeutral = true;
      } else if (waitingForNeutral) {
        if (isGameplayNeutral(frame)) waitingForNeutral = false;
      } else if (!areGamepadControlFramesEqual(frame, previousFrame)) {
        if (frame.moveX !== previousFrame.moveX) {
          handlers.onMoveChange(frame.moveX);
        }
        if (frame.jumpHeld !== previousFrame.jumpHeld) {
          handlers.onJumpChange(frame.jumpHeld);
        }
        if (
          frame.aim?.x !== previousFrame.aim?.x ||
          frame.aim?.y !== previousFrame.aim?.y ||
          frame.fireHeld !== previousFrame.fireHeld
        ) {
          handlers.onAimChange(frame.aim, frame.fireHeld);
        }
        previousFrame = frame;
      }

      wasEnabled = handlers.enabled;
      animationFrame = window.requestAnimationFrame(tick);
    };

    animationFrame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      releaseGameplay();
    };
  }, []);
}
