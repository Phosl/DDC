"use client";

import { useEffect, useRef } from "react";

import type { AimVector } from "@/lib/rise-game";

type AimJoystickProps = Readonly<{
  className?: string;
  disabled: boolean;
  onAimChange: (aim: AimVector | null, fireHeld: boolean) => void;
}>;

const ENGAGE_THRESHOLD = 0.18;
const RELEASE_THRESHOLD = 0.1;
const KEYBOARD_AIM: AimVector = { x: 0, y: -1 };

export function AimJoystick({
  className,
  disabled,
  onAimChange,
}: AimJoystickProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const engagedRef = useRef(false);
  const gestureEngagedRef = useRef(false);

  const resetVisual = () => {
    const button = buttonRef.current;
    if (!button) return;
    button.style.setProperty("--aim-x", "0");
    button.style.setProperty("--aim-y", "0");
    button.dataset.active = "false";
  };

  const releaseAim = () => {
    engagedRef.current = false;
    resetVisual();
    onAimChange(null, false);
  };

  const updatePointerAim = (
    button: HTMLButtonElement,
    clientX: number,
    clientY: number,
  ) => {
    const bounds = button.getBoundingClientRect();
    const radius = Math.max(1, Math.min(bounds.width, bounds.height) / 2);
    const rawX = (clientX - (bounds.left + bounds.width / 2)) / radius;
    const rawY = (clientY - (bounds.top + bounds.height / 2)) / radius;
    const magnitude = Math.hypot(rawX, rawY);
    const nextEngaged = engagedRef.current
      ? magnitude >= RELEASE_THRESHOLD
      : magnitude >= ENGAGE_THRESHOLD;
    const scale = magnitude > 1 ? 1 / magnitude : 1;
    const x = rawX * scale;
    const y = rawY * scale;
    const aim = nextEngaged
      ? { x: rawX / magnitude, y: rawY / magnitude }
      : null;

    button.style.setProperty("--aim-x", String(nextEngaged ? x : 0));
    button.style.setProperty("--aim-y", String(nextEngaged ? y : 0));
    button.dataset.active = String(nextEngaged);
    engagedRef.current = nextEngaged;
    if (nextEngaged) gestureEngagedRef.current = true;
    onAimChange(aim, nextEngaged);
  };

  useEffect(() => {
    if (disabled) {
      pointerIdRef.current = null;
      gestureEngagedRef.current = false;
      releaseAim();
    }
    // The callback is deliberately excluded: disabling is the state transition
    // that must cancel an in-flight gesture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  return (
    <button
      ref={buttonRef}
      className={className}
      type="button"
      aria-label="Mira e spara a 360 gradi"
      data-testid="aim-joystick"
      data-active="false"
      disabled={disabled}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        event.preventDefault();
        if (pointerIdRef.current !== null) return;
        pointerIdRef.current = event.pointerId;
        gestureEngagedRef.current = false;
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Synthetic pointers may not support capture; release handlers remain safe.
        }
        updatePointerAim(event.currentTarget, event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        if (pointerIdRef.current !== event.pointerId) return;
        event.preventDefault();
        updatePointerAim(event.currentTarget, event.clientX, event.clientY);
      }}
      onPointerUp={(event) => {
        if (pointerIdRef.current !== event.pointerId) return;
        event.preventDefault();
        const gestureEngaged = gestureEngagedRef.current;
        pointerIdRef.current = null;
        gestureEngagedRef.current = false;
        if (!gestureEngaged) {
          onAimChange(KEYBOARD_AIM, true);
        }
        releaseAim();
      }}
      onPointerCancel={(event) => {
        if (pointerIdRef.current !== event.pointerId) return;
        pointerIdRef.current = null;
        gestureEngagedRef.current = false;
        releaseAim();
      }}
      onLostPointerCapture={(event) => {
        if (pointerIdRef.current !== event.pointerId) return;
        pointerIdRef.current = null;
        gestureEngagedRef.current = false;
        releaseAim();
      }}
      onKeyDown={(event) => {
        if ((event.code !== "Space" && event.code !== "Enter") || event.repeat) return;
        event.preventDefault();
        engagedRef.current = true;
        event.currentTarget.dataset.active = "true";
        event.currentTarget.style.setProperty("--aim-y", "-1");
        onAimChange(KEYBOARD_AIM, true);
      }}
      onKeyUp={(event) => {
        if (event.code !== "Space" && event.code !== "Enter") return;
        event.preventDefault();
        releaseAim();
      }}
      onBlur={() => {
        if (engagedRef.current) releaseAim();
      }}
    >
      <span aria-hidden="true">360°</span>
      <i aria-hidden="true" />
    </button>
  );
}
