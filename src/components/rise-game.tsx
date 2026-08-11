"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import Link from "next/link";

import { GameAudioEngine } from "../lib/game-audio";
import { drawRiseGameScene } from "../lib/rise-game-visuals";
import styles from "./rise-game.module.css";

gsap.registerPlugin(useGSAP);

const GAME_DURATION_MS = 60_000;
const START_QUOTA = -900;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const CHAPTERS = [
  "CANTO I · GIUDECCA",
  "CANTO II · DITE",
  "CANTO III · LE STELLE",
] as const;

type GamePhase = "intro" | "playing" | "paused" | "result";
type EntityKind = "noise" | "voice";
type FeedbackTone = "noise" | "voice" | "breath";

type Viewport = {
  width: number;
  height: number;
  dpr: number;
};

type GameEntity = {
  id: number;
  kind: EntityKind;
  x: number;
  y: number;
  baseY: number;
  radius: number;
  speed: number;
  age: number;
  phase: number;
  wobble: number;
  wobbleSpeed: number;
  rotation: number;
  consumed: boolean;
};

type GameSignal = {
  tone: FeedbackTone;
  label: string;
};

type GameProjectile = {
  x: number;
  y: number;
  speed: number;
  age: number;
  consumed: boolean;
};

type GameBurst = {
  x: number;
  y: number;
  age: number;
  tone: "noise" | "voice";
};

type GameRuntime = {
  viewport: Viewport;
  elapsedMs: number;
  quota: number;
  breath: number;
  voices: number;
  playerY: number;
  playerVelocity: number;
  thrusting: boolean;
  entities: GameEntity[];
  projectiles: GameProjectile[];
  bursts: GameBurst[];
  nextEntityId: number;
  obstacleCooldown: number;
  voiceCooldown: number;
  verseCooldown: number;
  breathWarningShown: boolean;
  lastFrameAt: number;
  lastHudAt: number;
};

type HudState = {
  remaining: number;
  quota: number;
  breath: number;
  voices: number;
  chapter: (typeof CHAPTERS)[number];
};

type GameResult = {
  quota: number;
  voices: number;
  message: string;
};

type Feedback = GameSignal & {
  id: number;
};

function subscribeToReducedMotion(onChange: () => void) {
  if (typeof window === "undefined") return () => undefined;

  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

function getReducedMotionSnapshot() {
  return typeof window !== "undefined"
    ? window.matchMedia(REDUCED_MOTION_QUERY).matches
    : false;
}

function useReducedMotion() {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function getChapter(elapsedMs: number) {
  const chapterIndex = Math.min(
    CHAPTERS.length - 1,
    Math.floor((elapsedMs / GAME_DURATION_MS) * CHAPTERS.length),
  );

  return CHAPTERS[chapterIndex];
}

function getChapterIndex(elapsedMs: number) {
  return CHAPTERS.indexOf(getChapter(elapsedMs));
}

function formatQuota(quota: number) {
  const roundedQuota = Math.round(quota);
  return roundedQuota >= 0 ? `+${roundedQuota}` : `${roundedQuota}`;
}

function getResultMessage(quota: number) {
  if (quota >= 140) return "Hai bucato il cielo. Le stelle rispondono.";
  if (quota >= 0) return "Hai trovato aria. La voce resta.";
  return "Sei ancora sotto. Ma adesso conosci la via.";
}

function createRuntime(width = 405, height = 720): GameRuntime {
  return {
    viewport: { width, height, dpr: 1 },
    elapsedMs: 0,
    quota: START_QUOTA,
    breath: 100,
    voices: 0,
    playerY: height * 0.62,
    playerVelocity: 0,
    thrusting: false,
    entities: [],
    projectiles: [],
    bursts: [],
    nextEntityId: 0,
    obstacleCooldown: 1.1,
    voiceCooldown: 1.7,
    verseCooldown: 0,
    breathWarningShown: false,
    lastFrameAt: 0,
    lastHudAt: 0,
  };
}

function resetRuntime(runtime: GameRuntime) {
  const nextRuntime = createRuntime(
    runtime.viewport.width,
    runtime.viewport.height,
  );
  nextRuntime.viewport.dpr = runtime.viewport.dpr;
  Object.assign(runtime, nextRuntime);
}

function spawnEntity(
  runtime: GameRuntime,
  kind: EntityKind,
  easyMode: boolean,
) {
  const { width, height } = runtime.viewport;
  const safeTop = Math.max(76, height * 0.13);
  const safeBottom = Math.min(height - 72, height * 0.86);
  const radius =
    kind === "noise"
      ? clamp(width * randomBetween(0.05, 0.075), 18, 34)
      : clamp(width * 0.038, 13, 20);
  const baseY = randomBetween(safeTop, safeBottom);

  runtime.entities.push({
    id: runtime.nextEntityId,
    kind,
    x: width + radius + randomBetween(4, 42),
    y: baseY,
    baseY,
    radius,
    speed:
      width / randomBetween(easyMode ? 4.7 : 3.8, easyMode ? 5.4 : 4.5) +
      randomBetween(14, 30),
    age: 0,
    phase: randomBetween(0, Math.PI * 2),
    wobble: kind === "noise" ? randomBetween(8, 20) : randomBetween(5, 12),
    wobbleSpeed: randomBetween(1.2, 2.4),
    rotation: randomBetween(-0.8, 0.8),
    consumed: false,
  });
  runtime.nextEntityId += 1;
}

function updateRuntime(
  runtime: GameRuntime,
  deltaSeconds: number,
  holding: boolean,
  easyMode: boolean,
  reducedMotion: boolean,
) {
  const signals: GameSignal[] = [];
  const { width, height } = runtime.viewport;
  const playerRadius = clamp(width * 0.037, 13, 19);
  const playerX = Math.max(68, width * 0.24);

  runtime.thrusting = holding && runtime.breath > 0.4;

  if (holding) {
    runtime.breath = Math.max(
      0,
      runtime.breath - (easyMode ? 22 : 28) * deltaSeconds,
    );
  } else {
    runtime.breath = Math.min(
      100,
      runtime.breath + (easyMode ? 32 : 25) * deltaSeconds,
    );
  }

  if (runtime.breath <= 0.2 && !runtime.breathWarningShown) {
    runtime.breathWarningShown = true;
    signals.push({ tone: "breath", label: "FIATO CORTO — RILASCIA" });
  } else if (runtime.breath > 22) {
    runtime.breathWarningShown = false;
  }

  const acceleration = runtime.thrusting
    ? easyMode
      ? -720
      : -790
    : easyMode
      ? 390
      : 470;

  runtime.playerVelocity += acceleration * deltaSeconds;
  runtime.playerVelocity *= Math.exp(-1.15 * deltaSeconds);
  runtime.playerVelocity = clamp(runtime.playerVelocity, -300, 270);
  runtime.playerY += runtime.playerVelocity * deltaSeconds;

  const topBoundary = Math.max(62, playerRadius * 2.8);
  const bottomBoundary = height - Math.max(68, playerRadius * 3.2);

  if (runtime.playerY < topBoundary) {
    runtime.playerY = topBoundary;
    runtime.playerVelocity = Math.max(40, runtime.playerVelocity * -0.28);
  } else if (runtime.playerY > bottomBoundary) {
    runtime.playerY = bottomBoundary;
    runtime.playerVelocity = Math.min(-34, runtime.playerVelocity * -0.25);
  }

  runtime.verseCooldown -= deltaSeconds;

  if (runtime.thrusting && runtime.verseCooldown <= 0) {
    runtime.projectiles.push({
      x: playerX + playerRadius * 0.8,
      y: runtime.playerY - playerRadius * 0.15,
      speed: Math.max(260, width * 0.78),
      age: 0,
      consumed: false,
    });
    runtime.verseCooldown = easyMode ? 0.24 : 0.3;
  }

  for (const projectile of runtime.projectiles) {
    projectile.age += deltaSeconds;
    projectile.x += projectile.speed * deltaSeconds;
  }

  for (const burst of runtime.bursts) burst.age += deltaSeconds;

  const ascentRate = runtime.thrusting
    ? easyMode
      ? 43
      : 39
    : easyMode
      ? 12
      : 8;
  runtime.quota = Math.min(480, runtime.quota + ascentRate * deltaSeconds);

  runtime.obstacleCooldown -= deltaSeconds;
  runtime.voiceCooldown -= deltaSeconds;

  if (runtime.obstacleCooldown <= 0) {
    spawnEntity(runtime, "noise", easyMode);
    runtime.obstacleCooldown = randomBetween(
      easyMode ? 1.65 : 1.08,
      easyMode ? 2.25 : 1.56,
    );
  }

  if (runtime.voiceCooldown <= 0) {
    spawnEntity(runtime, "voice", easyMode);
    runtime.voiceCooldown = randomBetween(1.75, 2.65);
  }

  for (const entity of runtime.entities) {
    entity.age += deltaSeconds;
    entity.x -= entity.speed * deltaSeconds;
    const wobble = reducedMotion
      ? 0
      : Math.sin(entity.age * entity.wobbleSpeed + entity.phase) *
        entity.wobble;
    entity.y = entity.baseY + wobble;

    if (entity.kind === "noise" && !entity.consumed) {
      for (const projectile of runtime.projectiles) {
        if (projectile.consumed) continue;

        const verseDeltaX = projectile.x - entity.x;
        const verseDeltaY = projectile.y - entity.y;
        const verseHitRadius = entity.radius * 0.76 + 6;

        if (
          verseDeltaX * verseDeltaX + verseDeltaY * verseDeltaY <=
          verseHitRadius * verseHitRadius
        ) {
          projectile.consumed = true;
          entity.consumed = true;
          runtime.bursts.push({
            x: entity.x,
            y: entity.y,
            age: 0,
            tone: "noise",
          });
          signals.push({ tone: "voice", label: "RUMORE SPEZZATO" });
          break;
        }
      }
    }

    const deltaX = playerX - entity.x;
    const deltaY = runtime.playerY - entity.y;
    const hitRadius =
      playerRadius + entity.radius * (entity.kind === "noise" ? 0.72 : 1.05);
    const hasCollision =
      deltaX * deltaX + deltaY * deltaY <= hitRadius * hitRadius;
    const assistedVoicePickup =
      easyMode &&
      entity.kind === "voice" &&
      entity.x <= playerX + playerRadius &&
      entity.x >= playerX - entity.radius;

    if (!entity.consumed && (hasCollision || assistedVoicePickup)) {
      entity.consumed = true;

      if (entity.kind === "voice") {
        runtime.voices += 1;
        runtime.quota = Math.min(480, runtime.quota + 18);
        runtime.bursts.push({
          x: entity.x,
          y: entity.y,
          age: 0,
          tone: "voice",
        });
        signals.push({ tone: "voice", label: "VOCE +1" });
      } else if (easyMode) {
        runtime.bursts.push({
          x: entity.x,
          y: entity.y,
          age: 0,
          tone: "voice",
        });
        signals.push({ tone: "breath", label: "RUMORE SUPERATO" });
      } else {
        const quotaPenalty = 36;
        runtime.quota = Math.max(-999, runtime.quota - quotaPenalty);
        runtime.breath = Math.max(0, runtime.breath - 10);
        runtime.playerVelocity = Math.min(
          270,
          runtime.playerVelocity + 165,
        );
        runtime.bursts.push({
          x: entity.x,
          y: entity.y,
          age: 0,
          tone: "noise",
        });
        signals.push({
          tone: "noise",
          label: `RUMORE −${quotaPenalty} M`,
        });
      }
    }
  }

  runtime.entities = runtime.entities.filter(
    (entity) => !entity.consumed && entity.x > -entity.radius * 2,
  );
  runtime.projectiles = runtime.projectiles.filter(
    (projectile) => !projectile.consumed && projectile.x < width + 32,
  );
  runtime.bursts = runtime.bursts.filter((burst) => burst.age < 0.46);

  return signals;
}

export function RiseGame() {
  const reducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const pauseRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<GameRuntime>(createRuntime());
  const phaseRef = useRef<GamePhase>("intro");
  const holdingRef = useRef(false);
  const activeInputsRef = useRef(new Set<string>());
  const easyModeRef = useRef(false);
  const reducedMotionRef = useRef(reducedMotion);
  const feedbackIdRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const audioRef = useRef<GameAudioEngine | null>(null);
  const audioEnabledRef = useRef(true);

  const [phase, setPhase] = useState<GamePhase>("intro");
  const [easyMode, setEasyMode] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [audioAvailable, setAudioAvailable] = useState(true);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [announcement, setAnnouncement] = useState(
    "Cantica Zero pronta. Tieni premuto per salire e lanciare Versi; rilascia per respirare.",
  );
  const [result, setResult] = useState<GameResult | null>(null);
  const [hud, setHud] = useState<HudState>({
    remaining: 60,
    quota: START_QUOTA,
    breath: 100,
    voices: 0,
    chapter: CHAPTERS[0],
  });

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    easyModeRef.current = easyMode;
  }, [easyMode]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

  useEffect(
    () => () => {
      audioRef.current?.dispose();
      audioRef.current = null;
    },
    [],
  );

  useGSAP(
    () => {
      const activePanel =
        phase === "intro"
          ? introRef.current
          : phase === "result"
            ? resultRef.current
            : null;

      if (!activePanel) return;

      gsap.fromTo(
        activePanel,
        {
          autoAlpha: 0,
          y: reducedMotion ? 0 : 22,
        },
        {
          autoAlpha: 1,
          y: 0,
          duration: reducedMotion ? 0.01 : 0.62,
          ease: "power3.out",
          clearProps: "transform",
        },
      );
    },
    {
      scope: rootRef,
      dependencies: [phase, reducedMotion],
      revertOnUpdate: true,
    },
  );

  useGSAP(
    () => {
      if (!feedback || !feedbackRef.current) return;

      const timeline = gsap.timeline();
      timeline
        .fromTo(
          feedbackRef.current,
          {
            autoAlpha: 0,
            scale: reducedMotion ? 1 : 0.92,
            y: reducedMotion ? 0 : 14,
          },
          {
            autoAlpha: 1,
            scale: 1,
            y: 0,
            duration: reducedMotion ? 0.01 : 0.18,
            ease: "power2.out",
          },
        )
        .to(feedbackRef.current, {
          autoAlpha: 0,
          duration: reducedMotion ? 0.12 : 0.32,
          delay: reducedMotion ? 0.72 : 0.58,
        });
    },
    {
      scope: rootRef,
      dependencies: [feedback?.id, reducedMotion],
      revertOnUpdate: true,
    },
  );

  useEffect(() => {
    if (phase === "result") {
      window.requestAnimationFrame(() =>
        resultRef.current?.focus({ preventScroll: true }),
      );
    } else if (phase === "paused") {
      window.requestAnimationFrame(() =>
        pauseRef.current?.focus({ preventScroll: true }),
      );
    }
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    const resizeCanvas = () => {
      const bounds = canvas.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;

      const runtime = runtimeRef.current;
      const previousWidth = runtime.viewport.width;
      const previousHeight = runtime.viewport.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(bounds.width * dpr);
      canvas.height = Math.round(bounds.height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.imageSmoothingEnabled = false;

      if (previousHeight > 0) {
        const scaleY = bounds.height / previousHeight;
        runtime.playerY *= scaleY;
        for (const entity of runtime.entities) {
          entity.y *= scaleY;
          entity.baseY *= scaleY;
          entity.wobble *= scaleY;
        }
        for (const projectile of runtime.projectiles) projectile.y *= scaleY;
        for (const burst of runtime.bursts) burst.y *= scaleY;
      }

      if (previousWidth > 0) {
        const scaleX = bounds.width / previousWidth;
        for (const entity of runtime.entities) {
          entity.x *= scaleX;
          entity.radius *= scaleX;
          entity.speed *= scaleX;
        }
        for (const projectile of runtime.projectiles) {
          projectile.x *= scaleX;
          projectile.speed *= scaleX;
        }
        for (const burst of runtime.bursts) burst.x *= scaleX;
      }

      runtime.viewport = {
        width: bounds.width,
        height: bounds.height,
        dpr,
      };
      drawRiseGameScene(
        context,
        runtime,
        reducedMotionRef.current,
        getChapterIndex(runtime.elapsedMs),
      );
    };

    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas);
    resizeCanvas();

    const renderFrame = (now: number) => {
      const runtime = runtimeRef.current;

      if (phaseRef.current === "playing") {
        if (runtime.lastFrameAt === 0) runtime.lastFrameAt = now;
        const elapsedDeltaSeconds = Math.max(
          0,
          (now - runtime.lastFrameAt) / 1_000,
        );
        const remainingGameSeconds = Math.max(
          0,
          (GAME_DURATION_MS - runtime.elapsedMs) / 1_000,
        );
        const previousChapterIndex = getChapterIndex(runtime.elapsedMs);
        runtime.lastFrameAt = now;
        runtime.elapsedMs = Math.min(
          GAME_DURATION_MS,
          runtime.elapsedMs + elapsedDeltaSeconds * 1_000,
        );

        const signals: GameSignal[] = [];
        const currentChapterIndex = getChapterIndex(runtime.elapsedMs);

        if (currentChapterIndex !== previousChapterIndex) {
          signals.push({
            tone: "breath",
            label: CHAPTERS[currentChapterIndex],
          });
        }

        let remainingSimulationSeconds = Math.min(
          elapsedDeltaSeconds,
          remainingGameSeconds,
          0.25,
        );

        while (remainingSimulationSeconds > 0) {
          const stepSeconds = Math.min(remainingSimulationSeconds, 0.034);
          signals.push(
            ...updateRuntime(
              runtime,
              stepSeconds,
              holdingRef.current,
              easyModeRef.current,
              reducedMotionRef.current,
            ),
          );
          remainingSimulationSeconds -= stepSeconds;
        }

        for (const signal of signals) {
          audioRef.current?.playSignal(signal.tone);
          feedbackIdRef.current += 1;
          setFeedback({ ...signal, id: feedbackIdRef.current });
          setAnnouncement(signal.label);
        }

        audioRef.current?.setThrusting(runtime.thrusting);

        if (now - runtime.lastHudAt >= 100) {
          runtime.lastHudAt = now;
          setHud({
            remaining: Math.max(
              0,
              Math.ceil((GAME_DURATION_MS - runtime.elapsedMs) / 1_000),
            ),
            quota: Math.round(runtime.quota),
            breath: Math.round(runtime.breath),
            voices: runtime.voices,
            chapter: getChapter(runtime.elapsedMs),
          });
        }

        if (runtime.elapsedMs >= GAME_DURATION_MS) {
          holdingRef.current = false;
          runtime.thrusting = false;
          phaseRef.current = "result";
          const finalResult = {
            quota: Math.round(runtime.quota),
            voices: runtime.voices,
            message: getResultMessage(runtime.quota),
          };
          setResult(finalResult);
          setHud((currentHud) => ({
            ...currentHud,
            remaining: 0,
            quota: finalResult.quota,
            voices: finalResult.voices,
            breath: Math.round(runtime.breath),
          }));
          setPhase("result");
          audioRef.current?.finish(finalResult.quota >= 0);
          setAnnouncement(
            `Tempo scaduto. Quota ${formatQuota(finalResult.quota)}. ${finalResult.message}`,
          );
        }
      } else {
        runtime.lastFrameAt = now;
      }

      drawRiseGameScene(
        context,
        runtime,
        reducedMotionRef.current,
        getChapterIndex(runtime.elapsedMs),
      );
      animationFrameRef.current =
        phaseRef.current === "playing"
          ? window.requestAnimationFrame(renderFrame)
          : null;
    };

    animationFrameRef.current = window.requestAnimationFrame(renderFrame);

    return () => {
      resizeObserver.disconnect();
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [phase]);

  useEffect(() => {
    const isInteractiveTarget = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      Boolean(target.closest("button, a, input, select, textarea"));

    const pauseCurrentGame = (message: string) => {
      holdingRef.current = false;
      activeInputsRef.current.clear();
      if (phaseRef.current !== "playing") return;

      runtimeRef.current.thrusting = false;
      audioRef.current?.pause();
      phaseRef.current = "paused";
      setPhase("paused");
      setAnnouncement(message);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isInteractiveTarget(event.target)) return;

      if (event.code === "KeyP") {
        event.preventDefault();
        if (event.repeat) return;

        if (phaseRef.current === "playing") {
          pauseCurrentGame("Partita in pausa.");
        } else if (phaseRef.current === "paused") {
          runtimeRef.current.lastFrameAt = performance.now();
          if (audioEnabledRef.current) audioRef.current?.resume();
          phaseRef.current = "playing";
          setPhase("playing");
          setAnnouncement("Partita ripresa.");
          window.requestAnimationFrame(() =>
            canvasRef.current?.focus({ preventScroll: true }),
          );
        }
        return;
      }

      if (
        phaseRef.current === "playing" &&
        (event.code === "Space" || event.code === "ArrowUp")
      ) {
        event.preventDefault();
        activeInputsRef.current.add(event.code);
        holdingRef.current = activeInputsRef.current.size > 0;
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.code === "ArrowUp") {
        if (!isInteractiveTarget(event.target)) event.preventDefault();
        activeInputsRef.current.delete(event.code);
        holdingRef.current = activeInputsRef.current.size > 0;
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        pauseCurrentGame("Partita in pausa perché la pagina non è più visibile.");
      }
    };

    const onWindowBlur = () => {
      pauseCurrentGame("Partita in pausa perché la finestra non è più attiva.");
    };

    const canvas = canvasRef.current;
    const viewportObserver = canvas
      ? new IntersectionObserver(
          ([entry]) => {
            if (!entry?.isIntersecting) {
              pauseCurrentGame(
                "Partita in pausa perché il gioco non è più visibile.",
              );
            }
          },
          { threshold: 0.05 },
        )
      : null;

    if (canvas && viewportObserver) viewportObserver.observe(canvas);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onWindowBlur);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onWindowBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      viewportObserver?.disconnect();
    };
  }, []);

  const startGame = () => {
    let audioReady = true;

    if (audioEnabledRef.current) {
      audioRef.current ??= new GameAudioEngine();
      audioReady = audioRef.current.begin();

      if (!audioReady) {
        audioEnabledRef.current = false;
        setAudioEnabled(false);
        setAudioAvailable(false);
      }
    }

    resetRuntime(runtimeRef.current);
    holdingRef.current = false;
    activeInputsRef.current.clear();
    phaseRef.current = "playing";
    setResult(null);
    setFeedback(null);
    setHud({
      remaining: 60,
      quota: START_QUOTA,
      breath: 100,
      voices: 0,
      chapter: CHAPTERS[0],
    });
    setPhase("playing");
    setAnnouncement(
      audioReady
        ? "Partita iniziata. Tieni premuto per salire e lanciare Versi. Rilascia per recuperare fiato."
        : "Partita iniziata senza audio: il sound design non è disponibile.",
    );
    window.requestAnimationFrame(() =>
      canvasRef.current?.focus({ preventScroll: true }),
    );
  };

  const togglePause = () => {
    holdingRef.current = false;
    activeInputsRef.current.clear();

    if (phaseRef.current === "playing") {
      runtimeRef.current.thrusting = false;
      audioRef.current?.pause();
      phaseRef.current = "paused";
      setPhase("paused");
      setAnnouncement("Partita in pausa.");
    } else if (phaseRef.current === "paused") {
      runtimeRef.current.lastFrameAt = performance.now();
      if (audioEnabledRef.current) audioRef.current?.resume();
      phaseRef.current = "playing";
      setPhase("playing");
      setAnnouncement("Partita ripresa.");
      window.requestAnimationFrame(() =>
        canvasRef.current?.focus({ preventScroll: true }),
      );
    }
  };

  const toggleEasyMode = () => {
    setEasyMode((currentMode) => {
      const nextMode = !currentMode;
      easyModeRef.current = nextMode;
      setAnnouncement(
        nextMode
          ? "Modalità assistita attiva: il Rumore non penalizza, le Voci vengono raccolte automaticamente e hai più fiato."
          : "Modalità assistita disattivata.",
      );
      return nextMode;
    });

    if (phaseRef.current === "playing") {
      window.requestAnimationFrame(() =>
        canvasRef.current?.focus({ preventScroll: true }),
      );
    }
  };

  const toggleAudio = () => {
    const nextEnabled = !audioEnabledRef.current;

    if (!nextEnabled) {
      audioEnabledRef.current = false;
      setAudioEnabled(false);
      audioRef.current?.setEnabled(false);
      setAnnouncement("Audio disattivato.");
      if (phaseRef.current === "playing") {
        window.requestAnimationFrame(() =>
          canvasRef.current?.focus({ preventScroll: true }),
        );
      }
      return;
    }

    audioRef.current ??= new GameAudioEngine();
    const isAvailable = audioRef.current.setEnabled(true);

    if (!isAvailable) {
      audioEnabledRef.current = false;
      setAudioEnabled(false);
      setAudioAvailable(false);
      setAnnouncement("Audio non disponibile su questo browser.");
      if (phaseRef.current === "playing") {
        window.requestAnimationFrame(() =>
          canvasRef.current?.focus({ preventScroll: true }),
        );
      }
      return;
    }

    audioEnabledRef.current = true;
    setAudioEnabled(true);

    if (phaseRef.current === "playing") {
      audioRef.current.resume();
      audioRef.current.setThrusting(runtimeRef.current.thrusting);
    }

    setAnnouncement("Audio attivato.");
    if (phaseRef.current === "playing") {
      window.requestAnimationFrame(() =>
        canvasRef.current?.focus({ preventScroll: true }),
      );
    }
  };

  const handlePointerDown = (
    event: React.PointerEvent<HTMLCanvasElement>,
  ) => {
    if (phaseRef.current !== "playing") return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    activeInputsRef.current.add(`pointer:${event.pointerId}`);
    holdingRef.current = activeInputsRef.current.size > 0;
  };

  const releasePointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    activeInputsRef.current.delete(`pointer:${event.pointerId}`);
    holdingRef.current = activeInputsRef.current.size > 0;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <section ref={rootRef} className={styles.game} aria-labelledby="rise-game-title">
      <h2 id="rise-game-title" className={styles.srOnly}>
        Dall’inferno in su — Cantica Zero
      </h2>

      <div className={styles.hud} aria-hidden="true">
        <div className={styles.hudMetric}>
          <span>QUOTA</span>
          <strong>{formatQuota(hud.quota)}</strong>
        </div>
        <div className={styles.hudMetric}>
          <span>FIATO</span>
          <strong>{hud.breath}%</strong>
        </div>
        <div className={styles.hudMetric}>
          <span>VOCE</span>
          <strong>{String(hud.voices).padStart(2, "0")}</strong>
        </div>
        <div className={styles.hudMetric}>
          <span>TEMPO</span>
          <strong>{String(hud.remaining).padStart(2, "0")}</strong>
        </div>
      </div>

      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.toolButton}
          aria-label="Audio del gioco"
          aria-describedby="rise-game-audio-description"
          aria-pressed={audioEnabled}
          onClick={toggleAudio}
          disabled={!audioAvailable}
        >
          Audio {audioAvailable ? (audioEnabled ? "on" : "off") : "n/d"}
        </button>
        <button
          type="button"
          className={styles.toolButton}
          aria-pressed={easyMode}
          onClick={toggleEasyMode}
        >
          Assistita {easyMode ? "on" : "off"}
        </button>
        <button
          type="button"
          className={styles.toolButton}
          onClick={togglePause}
          disabled={phase === "intro" || phase === "result"}
        >
          {phase === "paused" ? "Riprendi" : "Pausa"}
        </button>
      </div>

      <span id="rise-game-audio-description" className={styles.srOnly}>
        {audioAvailable
          ? "Sound design procedurale attivabile e disattivabile."
          : "Sound design non disponibile su questo browser."}
      </span>

      <div
        className={styles.stage}
        data-cantica={CHAPTERS.indexOf(hud.chapter)}
      >
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          role="application"
          aria-roledescription="gioco arcade di risalita"
          tabIndex={phase === "playing" ? 0 : -1}
          aria-label="Area di gioco. Tieni premuto, oppure usa Spazio o Freccia su, per salire e lanciare Versi. Rilascia per recuperare fiato."
          aria-describedby="rise-game-instructions rise-game-accessibility"
          aria-keyshortcuts="Space ArrowUp P"
          onPointerDown={handlePointerDown}
          onPointerUp={releasePointer}
          onPointerCancel={releasePointer}
          onLostPointerCapture={(event) => {
            activeInputsRef.current.delete(`pointer:${event.pointerId}`);
            holdingRef.current = activeInputsRef.current.size > 0;
          }}
        />

        <div className={styles.chapter} aria-hidden="true">
          <span>{hud.chapter}</span>
          <span>{Math.min(3, CHAPTERS.indexOf(hud.chapter) + 1)} / 3</span>
        </div>

        <div className={styles.canticaRail} aria-hidden="true">
          {CHAPTERS.map((chapter, index) => (
            <span
              key={chapter}
              data-active={index <= CHAPTERS.indexOf(hud.chapter)}
            />
          ))}
        </div>

        <div
          ref={feedbackRef}
          className={styles.feedback}
          data-tone={feedback?.tone ?? "breath"}
          aria-hidden="true"
        >
          {feedback?.label}
        </div>

        {phase === "intro" ? (
          <div className={`${styles.overlay} ${styles.introOverlay}`}>
            <div ref={introRef} className={styles.overlayContent}>
              <p className={styles.kicker}>CANTO 00 / SOTTO QUOTA ZERO</p>
              <h3>Nel mezzo del rumore.</h3>
              <p className={styles.overlayCopy}>
                Hai perso la via, non la voce. Tieni premuto: sali e lancia
                Versi. Rilascia: respira.
              </p>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={startGame}
              >
                Entra nel primo cerchio
              </button>
              <p className={styles.modeNote}>
                Modalità assistita: {easyMode ? "attiva" : "non attiva"}
              </p>
            </div>
          </div>
        ) : null}

        {phase === "paused" ? (
          <div className={`${styles.overlay} ${styles.pauseOverlay}`}>
            <div
              ref={pauseRef}
              className={styles.overlayContent}
              tabIndex={-1}
            >
              <p className={styles.kicker}>TRA UN CANTO E L’ALTRO</p>
              <h3>Partita in pausa.</h3>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={togglePause}
              >
                Riprendi
              </button>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={startGame}
              >
                Ricomincia
              </button>
            </div>
          </div>
        ) : null}

        {phase === "result" && result ? (
          <div className={`${styles.overlay} ${styles.resultOverlay}`}>
            <div
              ref={resultRef}
              className={styles.overlayContent}
              tabIndex={-1}
            >
              <p className={styles.kicker}>FINE DELLA CANTICA</p>
              <p className={styles.resultQuota}>
                QUOTA {formatQuota(result.quota)}
              </p>
              <h3>{result.message}</h3>
              <p className={styles.overlayCopy}>
                Ogni risalita è un altro canto. Hai raccolto {result.voices}{" "}
                {result.voices === 1 ? "voce" : "voci"}.
              </p>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={startGame}
              >
                Riprova
              </button>
              <Link className={styles.secondaryButton} href="/#progetto">
                Esplora il progetto
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      <p id="rise-game-instructions" className={styles.instructions}>
        <span>HOLD / SALI + VERSI</span>
        <span>SPAZIO / ↑</span>
        <span>P PER PAUSA</span>
      </p>

      <p id="rise-game-accessibility" className={styles.srOnly}>
        Gioco arcade visivo in tre Canti: Giudecca, Dite e Le Stelle. Gli
        ostacoli Rumore e i frammenti Voce si muovono da destra verso sinistra.
        Tenendo premuto lanci Versi che possono spezzare il Rumore. In modalità
        assistita il Rumore non penalizza, le Voci vengono raccolte
        automaticamente e hai più fiato.
      </p>

      <dl className={styles.srOnly} aria-label="Stato corrente della partita">
        <dt>Quota</dt>
        <dd>{formatQuota(hud.quota)}</dd>
        <dt>Fiato</dt>
        <dd>{hud.breath} per cento</dd>
        <dt>Voci raccolte</dt>
        <dd>{hud.voices}</dd>
        <dt>Tempo rimasto</dt>
        <dd>{hud.remaining} secondi</dd>
        <dt>Capitolo</dt>
        <dd>{hud.chapter}</dd>
      </dl>

      <p className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}
