import type { GameInput } from "./types";

const INPUT_EDGE_KEYS = ["jumpPressed", "firePressed", "pausePressed"] as const;

export type InputEdges = Pick<GameInput, (typeof INPUT_EDGE_KEYS)[number]>;

export function mergeGameInput(
  current: Readonly<GameInput>,
  patch: Readonly<Partial<GameInput>>,
): GameInput {
  const next: GameInput = { ...current };

  if (patch.moveX !== undefined) next.moveX = patch.moveX;
  if (patch.jumpHeld !== undefined) next.jumpHeld = patch.jumpHeld;
  if (patch.fireHeld !== undefined) next.fireHeld = patch.fireHeld;

  for (const key of INPUT_EDGE_KEYS) {
    // A short press must survive DOM events until the gameplay tick consumes it.
    if (patch[key]) next[key] = true;
  }

  return next;
}

export function consumeInputEdges(input: Readonly<GameInput>): Readonly<{
  edges: InputEdges;
  next: GameInput;
}> {
  return {
    edges: {
      jumpPressed: input.jumpPressed,
      firePressed: input.firePressed,
      pausePressed: input.pausePressed,
    },
    next: {
      ...input,
      jumpPressed: false,
      firePressed: false,
      pausePressed: false,
    },
  };
}

export type JumpWindowState = Readonly<{
  lastGroundedAtMs: number | null;
  jumpBufferedAtMs: number | null;
  jumpCut: boolean;
}>;

export const INITIAL_JUMP_WINDOW_STATE: JumpWindowState = {
  lastGroundedAtMs: null,
  jumpBufferedAtMs: null,
  jumpCut: false,
};

type ResolveJumpFrameOptions = Readonly<{
  state: JumpWindowState;
  nowMs: number;
  grounded: boolean;
  jumpPressed: boolean;
  jumpHeld: boolean;
  velocityY: number;
  coyoteMs: number;
  jumpBufferMs: number;
  jumpVelocity: number;
  cutMultiplier?: number;
}>;

export type JumpFrameResult = Readonly<{
  state: JumpWindowState;
  velocityY: number;
  jumped: boolean;
  cut: boolean;
}>;

function isInsideWindow(nowMs: number, atMs: number | null, windowMs: number) {
  return atMs !== null && nowMs >= atMs && nowMs - atMs <= Math.max(0, windowMs);
}

export function resolveJumpFrame({
  state,
  nowMs,
  grounded,
  jumpPressed,
  jumpHeld,
  velocityY,
  coyoteMs,
  jumpBufferMs,
  jumpVelocity,
  cutMultiplier = 0.5,
}: ResolveJumpFrameOptions): JumpFrameResult {
  let lastGroundedAtMs = grounded ? nowMs : state.lastGroundedAtMs;
  let jumpBufferedAtMs = jumpPressed ? nowMs : state.jumpBufferedAtMs;
  let jumpCut = state.jumpCut;
  let nextVelocityY = velocityY;
  let jumped = false;
  let cut = false;

  if (
    isInsideWindow(nowMs, lastGroundedAtMs, coyoteMs) &&
    isInsideWindow(nowMs, jumpBufferedAtMs, jumpBufferMs)
  ) {
    nextVelocityY = jumpVelocity;
    lastGroundedAtMs = null;
    jumpBufferedAtMs = null;
    jumpCut = false;
    jumped = true;
  } else if (
    jumpBufferedAtMs !== null &&
    !isInsideWindow(nowMs, jumpBufferedAtMs, jumpBufferMs)
  ) {
    jumpBufferedAtMs = null;
  }

  if (!jumpHeld && !jumpCut && nextVelocityY < 0) {
    const safeMultiplier = Math.max(0, Math.min(1, cutMultiplier));
    nextVelocityY *= safeMultiplier;
    jumpCut = true;
    cut = true;
  }

  return {
    state: { lastGroundedAtMs, jumpBufferedAtMs, jumpCut },
    velocityY: nextVelocityY,
    jumped,
    cut,
  };
}

type VerseTrajectoryOptions = Readonly<{
  moveX: -1 | 0 | 1;
  facingDirection: -1 | 1;
  projectileSpeed: number;
}>;

export type VerseTrajectory = Readonly<{
  diagonal: boolean;
  direction: -1 | 1;
  angleDegrees: number;
  velocityX: number;
  velocityY: number;
}>;

export function resolveVerseTrajectory({
  moveX,
  facingDirection,
  projectileSpeed,
}: VerseTrajectoryOptions): VerseTrajectory {
  const diagonal = moveX !== 0;
  const direction = moveX === 0 ? facingDirection : moveX;
  const angleDegrees = diagonal ? -90 + 35 * direction : -90;
  const radians = (angleDegrees * Math.PI) / 180;
  const safeSpeed = Number.isFinite(projectileSpeed) ? Math.max(0, projectileSpeed) : 0;

  return {
    diagonal,
    direction,
    angleDegrees,
    velocityX: Math.cos(radians) * safeSpeed,
    velocityY: Math.sin(radians) * safeSpeed,
  };
}

type BreathRecoveryOptions = Readonly<{
  breath: number;
  maxBreath: number;
  lastShotAtMs: number;
  nowMs: number;
  deltaMs: number;
  rechargeDelayMs: number;
  rechargePerSecond: number;
}>;

export function spendBreath(breath: number, cost: number) {
  const current = Number.isFinite(breath) ? Math.max(0, breath) : 0;
  const safeCost = Number.isFinite(cost) ? Math.max(0, cost) : Number.POSITIVE_INFINITY;
  if (current < safeCost) return { breath: current, spent: false } as const;
  return { breath: current - safeCost, spent: true } as const;
}

export function recoverBreath({
  breath,
  maxBreath,
  lastShotAtMs,
  nowMs,
  deltaMs,
  rechargeDelayMs,
  rechargePerSecond,
}: BreathRecoveryOptions) {
  const safeMax = Number.isFinite(maxBreath) ? Math.max(0, maxBreath) : 0;
  const current = Number.isFinite(breath) ? Math.max(0, Math.min(safeMax, breath)) : 0;
  if (
    !Number.isFinite(nowMs) ||
    !Number.isFinite(deltaMs) ||
    deltaMs <= 0 ||
    (Number.isFinite(lastShotAtMs) &&
      nowMs - lastShotAtMs <= Math.max(0, rechargeDelayMs))
  ) {
    return current;
  }

  const recovery = (Math.max(0, rechargePerSecond) * deltaMs) / 1_000;
  return Math.min(safeMax, current + recovery);
}

export function restoreBreath(breath: number, amount: number, maxBreath: number) {
  const safeMax = Number.isFinite(maxBreath) ? Math.max(0, maxBreath) : 0;
  const current = Number.isFinite(breath) ? Math.max(0, Math.min(safeMax, breath)) : 0;
  const recovery = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  return Math.min(safeMax, current + recovery);
}

type VerticalViewportOptions = Readonly<{
  actorY: number;
  scrollY: number;
  viewportHeight: number;
  margin?: number;
}>;

export function isWithinVerticalViewport({
  actorY,
  scrollY,
  viewportHeight,
  margin = 0,
}: VerticalViewportOptions) {
  if (![actorY, scrollY, viewportHeight, margin].every(Number.isFinite)) return false;
  const safeHeight = Math.max(0, viewportHeight);
  const safeMargin = Math.max(0, margin);
  return actorY >= scrollY - safeMargin && actorY <= scrollY + safeHeight + safeMargin;
}

type OneWayCollisionOptions = Readonly<{
  actorBottom: number;
  actorVelocityY: number;
  platformTop: number;
  platformVelocityY?: number;
  tolerance?: number;
}>;

export function shouldCollideOneWay({
  actorBottom,
  actorVelocityY,
  platformTop,
  platformVelocityY = 0,
  tolerance = 12,
}: OneWayCollisionOptions) {
  const values = [actorBottom, actorVelocityY, platformTop, platformVelocityY, tolerance];
  if (!values.every(Number.isFinite)) return false;

  const relativeVelocityY = actorVelocityY - platformVelocityY;
  return relativeVelocityY >= 0 && actorBottom <= platformTop + Math.max(0, tolerance);
}

export type MovingPlatformState = Readonly<{
  position: number;
  origin: number;
  direction: -1 | 1;
  range: number;
  speed: number;
}>;

export function advanceMovingPlatform(
  state: MovingPlatformState,
  deltaMs: number,
): MovingPlatformState {
  const range = Math.max(0, state.range);
  const speed = Math.max(0, state.speed);
  if (range === 0 || speed === 0 || !Number.isFinite(deltaMs) || deltaMs <= 0) {
    return { ...state, position: Math.max(state.origin - range, Math.min(state.origin + range, state.position)) };
  }

  let position = Math.max(state.origin - range, Math.min(state.origin + range, state.position));
  let direction = state.direction;
  let remaining = ((speed * deltaMs) / 1_000) % (range * 4);

  while (remaining > 0) {
    const endpoint = state.origin + direction * range;
    const distanceToEndpoint = Math.abs(endpoint - position);
    if (remaining <= distanceToEndpoint) {
      position += direction * remaining;
      remaining = 0;
    } else {
      position = endpoint;
      remaining -= distanceToEndpoint;
      direction = direction === 1 ? -1 : 1;
    }
  }

  return { ...state, position, direction, range, speed };
}

export type ActIndex = 0 | 1 | 2;

export type RunProgressState = Readonly<{
  elapsedMs: number;
  lives: number;
  checkpointActIndex: ActIndex;
  recordEligible: boolean;
}>;

export const INITIAL_RUN_PROGRESS: RunProgressState = {
  elapsedMs: 0,
  lives: 3,
  checkpointActIndex: 0,
  recordEligible: true,
};

export function advanceRunTimer(
  state: RunProgressState,
  deltaMs: number,
  running: boolean,
): RunProgressState {
  if (!running || !Number.isFinite(deltaMs) || deltaMs <= 0) return state;
  return { ...state, elapsedMs: state.elapsedMs + deltaMs };
}

export function reachActCheckpoint(
  state: RunProgressState,
  actIndex: ActIndex,
): RunProgressState {
  if (actIndex <= state.checkpointActIndex) return state;
  return { ...state, checkpointActIndex: actIndex };
}

export function consumeLife(state: RunProgressState): Readonly<{
  state: RunProgressState;
  gameOver: boolean;
}> {
  const lives = Math.max(0, state.lives - 1);
  return { state: { ...state, lives }, gameOver: lives === 0 };
}

export function restartRunProgress(
  state: RunProgressState,
  mode: "full-run" | "continue-act",
): RunProgressState {
  if (mode === "full-run") return { ...INITIAL_RUN_PROGRESS };
  return { ...state, lives: 3, recordEligible: false };
}

export type RecordMode = "standard" | "assist";
export type BestTimes = Readonly<Record<RecordMode, number | null>>;

export const EMPTY_BEST_TIMES: BestTimes = { standard: null, assist: null };

export function getRecordMode(assist: boolean): RecordMode {
  return assist ? "assist" : "standard";
}

export function submitBestTime(
  current: BestTimes,
  run: Readonly<{ assist: boolean; elapsedMs: number; recordEligible: boolean }>,
): Readonly<{ bestTimes: BestTimes; isRecord: boolean }> {
  const roundedElapsedMs = Math.round(run.elapsedMs);
  if (!run.recordEligible || !Number.isFinite(roundedElapsedMs) || roundedElapsedMs <= 0) {
    return { bestTimes: current, isRecord: false };
  }

  const mode = getRecordMode(run.assist);
  const previous = current[mode];
  if (previous !== null && roundedElapsedMs >= previous) {
    return { bestTimes: current, isRecord: false };
  }

  return {
    bestTimes: { ...current, [mode]: roundedElapsedMs },
    isRecord: true,
  };
}

export type CampaignStep = Readonly<{
  circleId: string;
  actIndex: ActIndex;
  checkpoint: boolean;
  bossId?: string;
}>;

export type CampaignRunResult = Readonly<{
  visitedCircles: readonly string[];
  defeatedBosses: readonly string[];
  checkpointActIndex: ActIndex;
  complete: boolean;
}>;

/**
 * Replays the authored bottom-to-top campaign contract without Phaser or time.
 * Browser tests cover the runtime shell; this deterministic proof guards the
 * complete IX→I sequence, its checkpoints and every required custodian.
 */
export function simulateCampaignRun(
  steps: readonly CampaignStep[],
): CampaignRunResult {
  let checkpointActIndex: ActIndex = 0;
  const visitedCircles: string[] = [];
  const defeatedBosses: string[] = [];

  for (const step of steps) {
    visitedCircles.push(step.circleId);
    if (step.checkpoint && step.actIndex > checkpointActIndex) {
      checkpointActIndex = step.actIndex;
    }
    if (step.bossId) defeatedBosses.push(step.bossId);
  }

  const complete =
    visitedCircles.length === 9 &&
    new Set(visitedCircles).size === 9 &&
    defeatedBosses.length === 3 &&
    checkpointActIndex === 2;

  return {
    visitedCircles,
    defeatedBosses,
    checkpointActIndex,
    complete,
  };
}
