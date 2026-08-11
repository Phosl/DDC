"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import Link from "next/link";

import styles from "./rise-game.module.css";

gsap.registerPlugin(useGSAP);

const GAME_DURATION_MS = 60_000;
const START_QUOTA = -900;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const CHAPTERS = ["IL FONDO", "L’ATTRITO", "L’ARIA"] as const;
const CHAPTER_ACCENTS = ["#e7e1d7", "#ff2a78", "#27e0d1"] as const;

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
  nextEntityId: number;
  obstacleCooldown: number;
  voiceCooldown: number;
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
  if (quota >= 140) return "Hai bucato il cielo.";
  if (quota >= 0) return "Hai trovato aria.";
  return "Sei ancora sotto. Ma sei ancora vivo.";
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
    nextEntityId: 0,
    obstacleCooldown: 1.1,
    voiceCooldown: 1.7,
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
    signals.push({ tone: "breath", label: "RILASCIA PER RESPIRARE" });
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

  const playerRadius = clamp(width * 0.037, 13, 19);
  const topBoundary = Math.max(62, playerRadius * 2.8);
  const bottomBoundary = height - Math.max(68, playerRadius * 3.2);

  if (runtime.playerY < topBoundary) {
    runtime.playerY = topBoundary;
    runtime.playerVelocity = Math.max(40, runtime.playerVelocity * -0.28);
  } else if (runtime.playerY > bottomBoundary) {
    runtime.playerY = bottomBoundary;
    runtime.playerVelocity = Math.min(-34, runtime.playerVelocity * -0.25);
  }

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

  const playerX = Math.max(68, width * 0.24);

  for (const entity of runtime.entities) {
    entity.age += deltaSeconds;
    entity.x -= entity.speed * deltaSeconds;
    const wobble = reducedMotion
      ? 0
      : Math.sin(entity.age * entity.wobbleSpeed + entity.phase) *
        entity.wobble;
    entity.y = entity.baseY + wobble;

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
        signals.push({ tone: "voice", label: "VOCE +1" });
      } else if (easyMode) {
        signals.push({ tone: "breath", label: "RUMORE SUPERATO" });
      } else {
        const quotaPenalty = 36;
        runtime.quota = Math.max(-999, runtime.quota - quotaPenalty);
        runtime.breath = Math.max(0, runtime.breath - 10);
        runtime.playerVelocity = Math.min(
          270,
          runtime.playerVelocity + 165,
        );
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

  return signals;
}

function drawBackground(
  context: CanvasRenderingContext2D,
  runtime: GameRuntime,
  reducedMotion: boolean,
) {
  const { width, height } = runtime.viewport;
  const chapterIndex = getChapterIndex(runtime.elapsedMs);
  const accent = CHAPTER_ACCENTS[chapterIndex];
  const gradient = context.createLinearGradient(0, 0, 0, height);

  gradient.addColorStop(0, chapterIndex === 2 ? "#071414" : "#090909");
  gradient.addColorStop(0.58, "#080808");
  gradient.addColorStop(1, chapterIndex === 1 ? "#210813" : "#101010");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  const gridOffset = ((runtime.quota - START_QUOTA) * 0.75) % 88;
  context.save();
  context.strokeStyle = accent;
  context.globalAlpha = 0.12;
  context.lineWidth = 1;

  for (let y = -88 + gridOffset; y < height + 88; y += 88) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }

  context.globalAlpha = 0.07;
  context.setLineDash([2, 8]);
  context.beginPath();
  context.moveTo(width * 0.24, 0);
  context.lineTo(width * 0.24, height);
  context.stroke();
  context.restore();

  const moteCount = reducedMotion ? 8 : 24;
  const travel = reducedMotion ? 0 : runtime.elapsedMs * 0.018;

  context.save();
  context.fillStyle = accent;
  for (let index = 0; index < moteCount; index += 1) {
    const x = ((index * 83 + 31) % 101) * (width / 100);
    const y = (index * 97 + travel) % (height + 80) - 40;
    const radius = index % 4 === 0 ? 1.7 : 0.9;
    context.globalAlpha = 0.12 + (index % 5) * 0.035;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawEntity(
  context: CanvasRenderingContext2D,
  entity: GameEntity,
  reducedMotion: boolean,
) {
  context.save();
  context.translate(entity.x, entity.y);

  if (entity.kind === "noise") {
    context.rotate(reducedMotion ? entity.rotation : entity.rotation + entity.age * 0.2);
    context.shadowBlur = reducedMotion ? 0 : 18;
    context.shadowColor = "#ff2a78";
    context.fillStyle = "#111111";
    context.strokeStyle = "#ff2a78";
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(-entity.radius * 0.9, -entity.radius * 0.54);
    context.lineTo(entity.radius * 0.72, -entity.radius);
    context.lineTo(entity.radius, entity.radius * 0.48);
    context.lineTo(-entity.radius * 0.42, entity.radius);
    context.closePath();
    context.fill();
    context.stroke();
    context.rotate(-(reducedMotion ? entity.rotation : entity.rotation + entity.age * 0.2));
    context.shadowBlur = 0;
    context.fillStyle = "rgba(255,255,255,0.76)";
    context.font = "600 8px ui-monospace, SFMono-Regular, monospace";
    context.textAlign = "center";
    context.fillText("RUMORE", 0, entity.radius + 17);
  } else {
    context.rotate(Math.PI / 4);
    context.shadowBlur = reducedMotion ? 0 : 24;
    context.shadowColor = "#27e0d1";
    context.fillStyle = "rgba(39,224,209,0.16)";
    context.strokeStyle = "#27e0d1";
    context.lineWidth = 2;
    context.fillRect(
      -entity.radius * 0.72,
      -entity.radius * 0.72,
      entity.radius * 1.44,
      entity.radius * 1.44,
    );
    context.strokeRect(
      -entity.radius * 0.72,
      -entity.radius * 0.72,
      entity.radius * 1.44,
      entity.radius * 1.44,
    );
    context.rotate(-Math.PI / 4);
    context.shadowBlur = 0;
    context.fillStyle = "#dffffb";
    context.font = "700 8px ui-monospace, SFMono-Regular, monospace";
    context.textAlign = "center";
    context.fillText("VOCE", 0, entity.radius + 18);
  }

  context.restore();
}

function drawPlayer(
  context: CanvasRenderingContext2D,
  runtime: GameRuntime,
  reducedMotion: boolean,
) {
  const { width } = runtime.viewport;
  const x = Math.max(68, width * 0.24);
  const y = runtime.playerY;
  const radius = clamp(width * 0.037, 13, 19);
  const accent = CHAPTER_ACCENTS[getChapterIndex(runtime.elapsedMs)];

  context.save();

  if (runtime.thrusting && !reducedMotion) {
    const trail = context.createLinearGradient(x, y, x, y + radius * 5.5);
    trail.addColorStop(0, accent);
    trail.addColorStop(1, "rgba(255,255,255,0)");
    context.strokeStyle = trail;
    context.lineWidth = radius * 0.68;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(x, y + radius * 0.65);
    context.lineTo(x, y + radius * 4.7);
    context.stroke();
  }

  context.shadowBlur = reducedMotion ? 0 : 30;
  context.shadowColor = accent;
  context.fillStyle = "#f5f1e9";
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();

  context.shadowBlur = 0;
  context.fillStyle = "#080808";
  context.beginPath();
  context.moveTo(x, y - radius * 0.5);
  context.lineTo(x + radius * 0.43, y + radius * 0.35);
  context.lineTo(x - radius * 0.43, y + radius * 0.35);
  context.closePath();
  context.fill();
  context.restore();
}

function drawScene(
  context: CanvasRenderingContext2D,
  runtime: GameRuntime,
  reducedMotion: boolean,
) {
  const { width, height } = runtime.viewport;
  context.clearRect(0, 0, width, height);
  drawBackground(context, runtime, reducedMotion);

  for (const entity of runtime.entities) {
    drawEntity(context, entity, reducedMotion);
  }

  drawPlayer(context, runtime, reducedMotion);
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

  const [phase, setPhase] = useState<GamePhase>("intro");
  const [easyMode, setEasyMode] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [announcement, setAnnouncement] = useState(
    "Gioco pronto. Tieni premuto per salire e rilascia per respirare.",
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

    const context = canvas.getContext("2d");
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

      if (previousHeight > 0) {
        const scaleY = bounds.height / previousHeight;
        runtime.playerY *= scaleY;
        for (const entity of runtime.entities) {
          entity.y *= scaleY;
          entity.baseY *= scaleY;
        }
      }

      if (previousWidth > 0) {
        const scaleX = bounds.width / previousWidth;
        for (const entity of runtime.entities) entity.x *= scaleX;
      }

      runtime.viewport = {
        width: bounds.width,
        height: bounds.height,
        dpr,
      };
      drawScene(context, runtime, reducedMotionRef.current);
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
        runtime.lastFrameAt = now;
        runtime.elapsedMs = Math.min(
          GAME_DURATION_MS,
          runtime.elapsedMs + elapsedDeltaSeconds * 1_000,
        );

        const signals: GameSignal[] = [];
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
          feedbackIdRef.current += 1;
          setFeedback({ ...signal, id: feedbackIdRef.current });
          setAnnouncement(signal.label);
        }

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
          setAnnouncement(
            `Tempo scaduto. Quota ${formatQuota(finalResult.quota)}. ${finalResult.message}`,
          );
        }
      } else {
        runtime.lastFrameAt = now;
      }

      drawScene(context, runtime, reducedMotionRef.current);
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
      "Partita iniziata. Tieni premuto per salire e rilascia per recuperare fiato.",
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
      phaseRef.current = "paused";
      setPhase("paused");
      setAnnouncement("Partita in pausa.");
    } else if (phaseRef.current === "paused") {
      runtimeRef.current.lastFrameAt = performance.now();
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
        Dall’inferno in su — il gioco della risalita
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

      <div className={styles.stage}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          role="application"
          aria-roledescription="gioco d’azione"
          tabIndex={phase === "playing" ? 0 : -1}
          aria-label="Area di gioco. Tieni premuto, oppure usa Spazio o Freccia su, per salire. Rilascia per recuperare fiato."
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
              <p className={styles.kicker}>SEI SOTTO QUOTA ZERO</p>
              <h3>Dall’inferno in su.</h3>
              <p className={styles.overlayCopy}>
                Tieni premuto per salire. Lascia per respirare. Evita il
                rumore, trova la tua voce.
              </p>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={startGame}
              >
                Comincia
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
              <p className={styles.kicker}>PRENDI FIATO</p>
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
              <p className={styles.kicker}>LA TUA RISALITA</p>
              <p className={styles.resultQuota}>
                QUOTA {formatQuota(result.quota)}
              </p>
              <h3>{result.message}</h3>
              <p className={styles.overlayCopy}>
                Hai raccolto {result.voices} {result.voices === 1 ? "voce" : "voci"}.
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
        <span>TOUCH / HOLD</span>
        <span>SPAZIO / ↑</span>
        <span>P PER PAUSA</span>
      </p>

      <p id="rise-game-accessibility" className={styles.srOnly}>
        Gioco d’azione visivo: gli ostacoli Rumore e i frammenti Voce si
        muovono da destra verso sinistra. In modalità assistita il Rumore non
        penalizza, le Voci vengono raccolte automaticamente e hai più fiato.
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
