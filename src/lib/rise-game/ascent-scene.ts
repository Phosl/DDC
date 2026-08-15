import type Phaser from "phaser";

import {
  GAME_HEIGHT,
  GAME_WIDTH,
  RECORD_STORAGE_KEY,
  SNAPSHOT_INTERVAL_MS,
  TILE_SIZE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  getDifficultyTuning,
  resolveAdaptiveHorizontalBounds,
  resolveBackgroundTileTransform,
  resolveRuntimeWorldGeometry,
  type AdaptiveHorizontalRole,
  type RuntimeWorldGeometry,
} from "./config";
import type { DifficultyEnemyKind } from "./difficulty";
import {
  CIRCLE_LEVELS,
  LEVEL_HEIGHT,
  assertValidCircleLevels,
  getLevelWorldOffsetY,
  type CircleLevelDefinition,
} from "./level-data";
import type { AscentSceneHandle, RuntimeBridge } from "./internal";
import {
  INITIAL_JUMP_WINDOW_STATE,
  advanceMovingPlatform,
  isWithinVerticalViewport,
  normalizeAimVector,
  recoverBreath,
  resolveJumpFrame,
  resolveVerseTrajectory,
  restoreBreath,
  spendBreath,
  shouldCollideOneWay as shouldCollideOneWayRule,
  type JumpWindowState,
} from "./rules";
import type {
  AimVector,
  BossSnapshot,
  GameAudioCue,
  GamePhase,
  GameSnapshot,
  GameTelemetry,
} from "./types";
import {
  createBossVisualController,
  createEnemyVisualController,
  createPlayerVisualController,
  queueActorAtlases,
  registerActorAnimations,
  type ActorVisualController,
  type EnemyVisualController,
} from "./visuals/actor-visuals";
import {
  PLAYER_VISUAL,
  type BossVisualState,
  type PlayerVisualState,
} from "./visuals/visual-manifest";
import {
  createCanticaVfxSystem,
  preloadCanticaVfxAtlas,
  type CanticaVfxSystem,
} from "./visuals/vfx-system";

type PhaserNamespace = typeof Phaser;
type BodyGameObject = Phaser.GameObjects.Rectangle | Phaser.Physics.Arcade.Sprite;
type BodyObject = BodyGameObject & {
  body: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody;
};
type DynamicBodyObject = BodyGameObject & {
  body: Phaser.Physics.Arcade.Body;
};
type BossId = BossSnapshot["id"];
type EnemyKind = DifficultyEnemyKind;
type PickupKind = "voice" | "breath" | "rima" | "light";

type AdaptiveStaticGeometry = Readonly<{
  object: Phaser.GameObjects.Rectangle;
  role: Exclude<AdaptiveHorizontalRole, "fixed">;
  authoredLeft: number;
  authoredRight: number;
  height: number;
  visualHeight: number | null;
}>;

const BOSS_NAMES: Record<BossId, string> = {
  minotaur: "Minotauro",
  pluto: "Pluto",
  charon: "Caronte",
};

const PLAYER_TEXTURE = "cantica-player-v3";
const ENEMY_TEXTURE = "cantica-enemy-v3";
const BOSS_TEXTURE = "cantica-boss-v3";

const ACT_PALETTES = [
  { sky: 0x08131c, platform: 0x9ad9e5, accent: 0x39f4ff, shadow: 0x204050 },
  { sky: 0x210b0c, platform: 0xff8b52, accent: 0xffd166, shadow: 0x57201d },
  { sky: 0x10142c, platform: 0xa8b8ff, accent: 0xff7fd1, shadow: 0x303765 },
] as const;

const ENEMY_KINDS: readonly EnemyKind[] = [
  "walker",
  "charger",
  "sentry",
  "roller",
  "mimic",
];

const ASSET_PATHS = {
  platforms: "/game/v2/tiles/platforms.png",
} as const;

type TimedAttackState = Readonly<{
  actorActive: boolean;
  defeated: boolean;
  hp: number;
  bodyEnabled: boolean;
  phase: GamePhase;
}>;

export function canReleaseTimedAttack({
  actorActive,
  defeated,
  hp,
  bodyEnabled,
  phase,
}: TimedAttackState): boolean {
  return actorActive && !defeated && hp > 0 && bodyEnabled && phase === "playing";
}

export function resolveFacingDirection(velocityX: number, flipX: boolean): -1 | 1 {
  if (Math.abs(velocityX) > 1) return velocityX < 0 ? -1 : 1;
  return flipX ? -1 : 1;
}

export function resolveAimFacingDirection(
  aim: Readonly<{ x: number; y: number }> | null | undefined,
  velocityX: number,
  flipX: boolean,
): -1 | 1 {
  if (aim && Number.isFinite(aim.x) && Math.abs(aim.x) >= 0.12) {
    return aim.x < 0 ? -1 : 1;
  }
  return resolveFacingDirection(velocityX, flipX);
}

type PointerAimOptions = Readonly<{
  viewportX: number;
  viewportY: number;
  cameraScrollX: number;
  cameraScrollY: number;
  originX: number;
  originY: number;
}>;

/** Converts a viewport point into a unit vector from Davide's Verse socket. */
export function resolvePointerAimVector({
  viewportX,
  viewportY,
  cameraScrollX,
  cameraScrollY,
  originX,
  originY,
}: PointerAimOptions): AimVector | null {
  const values = [viewportX, viewportY, cameraScrollX, cameraScrollY, originX, originY];
  if (values.some((value) => !Number.isFinite(value))) return null;
  return normalizeAimVector(
    {
      x: cameraScrollX + viewportX - originX,
      y: cameraScrollY + viewportY - originY,
    },
    0,
  );
}

export function resolveVerseHitbox(angleDegrees: number, usesAtlas: boolean) {
  const radians = (angleDegrees * Math.PI) / 180;
  const rawCosine = Math.abs(Math.cos(radians));
  const rawSine = Math.abs(Math.sin(radians));
  const cosine = rawCosine < 1e-10 ? 0 : rawCosine;
  const sine = rawSine < 1e-10 ? 0 : rawSine;
  const longSide = usesAtlas ? 16 : 14;
  const shortSide = usesAtlas ? 8 : 7;
  return {
    width: longSide * cosine + shortSide * sine,
    height: longSide * sine + shortSide * cosine,
  };
}

export function isDirectionalVerseAngle(angleDegrees: number) {
  if (!Number.isFinite(angleDegrees)) return false;
  const degreesFromUp = Math.abs(
    ((((angleDegrees + 90) + 180) % 360) + 360) % 360 - 180,
  );
  return degreesFromUp > 12;
}

export function resolveSourceHitbox(
  worldWidth: number,
  worldHeight: number,
  scaleX: number,
  scaleY: number,
) {
  return {
    width: worldWidth / Math.max(0.001, Math.abs(scaleX)),
    height: worldHeight / Math.max(0.001, Math.abs(scaleY)),
  };
}

export function resolveStablePlatformPosition({
  platformX,
  platformY,
  platformLeft,
  platformRight,
  offsetX,
  offsetY,
  playerWidth,
  worldWidth,
  worldLeft = 0,
}: Readonly<{
  platformX: number;
  platformY: number;
  platformLeft: number;
  platformRight: number;
  offsetX: number;
  offsetY: number;
  playerWidth: number;
  worldWidth: number;
  worldLeft?: number;
}>) {
  const safeInset = playerWidth / 2 + 2;
  const minimumX = platformLeft + safeInset;
  const maximumX = platformRight - safeInset;
  const x =
    minimumX <= maximumX
      ? Math.max(minimumX, Math.min(maximumX, platformX + offsetX))
      : platformX;
  return {
    x: Math.max(worldLeft + 24, Math.min(worldLeft + worldWidth - 24, x)),
    y: platformY + offsetY,
  };
}

function isBodyObject(value: unknown): value is BodyObject {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { body?: unknown; getData?: unknown };
  return Boolean(candidate.body && typeof candidate.getData === "function");
}

function isDynamicBodyObject(value: unknown): value is DynamicBodyObject {
  return (
    isBodyObject(value) &&
    typeof value.body === "object" &&
    value.body !== null &&
    "velocity" in value.body
  );
}

function clampActIndex(value: number): 0 | 1 | 2 {
  return Math.max(0, Math.min(2, value)) as 0 | 1 | 2;
}

function readBestTime(assist: boolean): number | null {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage.getItem(
      assist ? RECORD_STORAGE_KEY.assist : RECORD_STORAGE_KEY.standard,
    );
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function writeBestTime(assist: boolean, elapsedMs: number) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      assist ? RECORD_STORAGE_KEY.assist : RECORD_STORAGE_KEY.standard,
      String(Math.round(elapsedMs)),
    );
  } catch {
    // The run still completes if private storage is unavailable.
  }
}

export function createAscentScene(
  PhaserRuntime: PhaserNamespace,
  bridge: RuntimeBridge,
): Phaser.Scene {
  class AscentScene
    extends PhaserRuntime.Scene
    implements AscentSceneHandle
  {
    private phase: GamePhase = "ready";
    private elapsedMs = 0;
    private lives = 3;
    private breath = getDifficultyTuning(bridge.assist).combat.maxBreath;
    private voices = 0;
    private strofe = 0;
    private recordEligible = true;
    private assistedRun = bridge.assist;
    private checkpointActIndex: 0 | 1 | 2 = 0;
    private shield = false;
    private rimaUntil = 0;
    private invulnerableUntil = 0;
    private lastShotAt = -Infinity;
    private lastShotWasDirectional = false;
    private lastShotSequence = 0;
    private lastShotTelemetry: GameTelemetry["lastShot"] = null;
    private lastSnapshotAt = -Infinity;
    private jumpWindowState: JumpWindowState = {
      ...INITIAL_JUMP_WINDOW_STATE,
      jumpCut: true,
    };
    private nextEmptyBreathFeedbackAt = -Infinity;
    private wasGrounded = false;
    private lastAirborneVelocityY = 0;
    private landedUntil = -Infinity;
    private hitUntil = -Infinity;
    private currentCircleIndex = 0;
    private announcedCircleIndex = -1;
    private statusText = "Preparati alla salita";
    private bestMs: number | null = null;
    private activeBoss: Phaser.Physics.Arcade.Sprite | null = null;
    private phaseBeforePause: GamePhase = "playing";
    private player!: Phaser.Physics.Arcade.Sprite;
    private aimReticle: Phaser.GameObjects.Arc | null = null;
    private authoredPlayer = false;
    private playerVisual: ActorVisualController<PlayerVisualState> | null = null;
    private enemyVisuals = new Map<Phaser.Physics.Arcade.Sprite, EnemyVisualController>();
    private bossVisuals = new Map<
      Phaser.Physics.Arcade.Sprite,
      ActorVisualController<BossVisualState>
    >();
    private vfx: CanticaVfxSystem | null = null;
    private staticPlatforms!: Phaser.GameObjects.Group;
    private oneWayPlatforms!: Phaser.GameObjects.Group;
    private movingPlatforms!: Phaser.GameObjects.Group;
    private crumblePlatforms!: Phaser.GameObjects.Group;
    private enemies!: Phaser.Physics.Arcade.Group;
    private pickups!: Phaser.Physics.Arcade.Group;
    private playerProjectiles!: Phaser.Physics.Arcade.Group;
    private hostileProjectiles!: Phaser.Physics.Arcade.Group;
    private bosses!: Phaser.Physics.Arcade.Group;
    private bossGates = new Map<BossId, Phaser.GameObjects.Rectangle>();
    private checkpointSpawns = new Map<number, Phaser.Math.Vector2>();
    private circleSpawns = new Map<number, Phaser.Math.Vector2>();
    private lastStableSpawn: Phaser.Math.Vector2 | null = null;
    private lastStablePlatform: BodyObject | null = null;
    private lastStablePlatformOffset: Phaser.Math.Vector2 | null = null;
    private bossCheckpointSpawn: Phaser.Math.Vector2 | null = null;
    private bossCheckpointCircleIndex = -1;
    private loadedActs = new Set<number>();
    private loadingActs = new Set<number>();
    private backgroundLevelsDrawn = new Set<string>();
    private backgroundTiles = new Set<Phaser.GameObjects.TileSprite>();
    private backgroundWashes = new Set<Phaser.GameObjects.Rectangle>();
    private adaptiveStaticGeometry = new Set<AdaptiveStaticGeometry>();
    private lastMovingPlatform: Phaser.GameObjects.GameObject | null = null;
    private assetLoadFailed = false;
    private viewportWidth = GAME_WIDTH;
    private viewportHeight = GAME_HEIGHT;
    private worldGeometry: RuntimeWorldGeometry = resolveRuntimeWorldGeometry(GAME_WIDTH);

    constructor() {
      super({ key: "cantica-zero-ascent" });
    }

    private get tuning() {
      return getDifficultyTuning(bridge.assist);
    }

    init() {
      this.phase = "ready";
      this.elapsedMs = 0;
      this.lives = 3;
      this.breath = this.tuning.combat.maxBreath;
      this.voices = 0;
      this.strofe = 0;
      this.recordEligible = true;
      this.assistedRun = bridge.assist;
      this.checkpointActIndex = 0;
      this.shield = false;
      this.rimaUntil = 0;
      this.invulnerableUntil = 0;
      this.lastShotAt = -Infinity;
      this.lastShotWasDirectional = false;
      this.lastShotSequence = 0;
      this.lastShotTelemetry = null;
      this.lastSnapshotAt = -Infinity;
      this.jumpWindowState = { ...INITIAL_JUMP_WINDOW_STATE, jumpCut: true };
      this.nextEmptyBreathFeedbackAt = -Infinity;
      this.wasGrounded = false;
      this.lastAirborneVelocityY = 0;
      this.landedUntil = -Infinity;
      this.hitUntil = -Infinity;
      this.currentCircleIndex = 0;
      this.announcedCircleIndex = -1;
      this.statusText = "Preparati alla salita";
      this.bestMs = readBestTime(this.assistedRun);
      this.activeBoss = null;
      this.phaseBeforePause = "playing";
      this.aimReticle = null;
      this.bossGates.clear();
      this.checkpointSpawns.clear();
      this.circleSpawns.clear();
      this.lastStableSpawn = null;
      this.lastStablePlatform = null;
      this.lastStablePlatformOffset = null;
      this.bossCheckpointSpawn = null;
      this.bossCheckpointCircleIndex = -1;
      this.loadedActs.clear();
      this.loadingActs.clear();
      this.backgroundLevelsDrawn.clear();
      this.backgroundTiles.clear();
      this.backgroundWashes.clear();
      this.adaptiveStaticGeometry.clear();
      this.lastMovingPlatform = null;
      this.assetLoadFailed = false;
      this.viewportWidth = Math.max(GAME_WIDTH, bridge.viewportWidth);
      this.viewportHeight = Math.max(1, bridge.viewportHeight);
      this.worldGeometry = resolveRuntimeWorldGeometry(this.viewportWidth);
      this.playerVisual = null;
      this.enemyVisuals.clear();
      this.bossVisuals.clear();
      this.vfx = null;
    }

    preload() {
      this.load.on("loaderror", () => {
        this.assetLoadFailed = true;
      });

      queueActorAtlases(this);
      preloadCanticaVfxAtlas(this);
      this.load.spritesheet("platform-v2", ASSET_PATHS.platforms, {
        frameWidth: 221,
        frameHeight: 295,
      });
      (["far", "mid", "near"] as const).forEach((layer) => {
        this.load.image(
          `background-giudecca-${layer}`,
          `/game/backgrounds/giudecca-${layer}.webp`,
        );
      });
    }

    create() {
      assertValidCircleLevels();
      this.createProceduralTextures();
      registerActorAnimations(this);
      this.createGroups();
      this.vfx = createCanticaVfxSystem(this, {
        reducedMotion: bridge.reducedMotion,
      });
      this.events.once(PhaserRuntime.Scenes.Events.SHUTDOWN, () => {
        this.playerVisual?.destroy();
        this.enemyVisuals.forEach((visual) => visual.destroy());
        this.bossVisuals.forEach((visual) => visual.destroy());
        this.vfx?.destroy();
        this.aimReticle = null;
        this.playerVisual = null;
        this.enemyVisuals.clear();
        this.bossVisuals.clear();
        this.vfx = null;
      });
      this.setViewportSize(bridge.viewportWidth, bridge.viewportHeight);
      this.cameras.main.setBackgroundColor(ACT_PALETTES[0].sky);
      this.cameras.main.roundPixels = true;

      CIRCLE_LEVELS.forEach((level, index) => this.buildLevel(level, index));
      this.loadedActs.add(0);

      const initialSpawn =
        this.checkpointSpawns.get(0) ??
        new PhaserRuntime.Math.Vector2(GAME_WIDTH / 2, WORLD_HEIGHT - 80);
      this.createPlayer(initialSpawn.x, initialSpawn.y);
      this.aimReticle = this.add
        .circle(initialSpawn.x, initialSpawn.y - 52, 5, 0x39f4ff, 0)
        .setStrokeStyle(2, 0x39f4ff, 0.9)
        .setDepth(14)
        .setVisible(false);
      this.lastStableSpawn = initialSpawn.clone();
      this.lastStablePlatform = null;
      this.lastStablePlatformOffset = null;
      this.createCollisions();

      this.cameras.main.scrollY = Math.max(0, WORLD_HEIGHT - this.viewportHeight);
      this.physics.pause();
      bridge.scene = this;

      if (bridge.pendingRestart) {
        const pending = bridge.pendingRestart;
        bridge.pendingRestart = null;
        this.restartGame(pending);
      } else if (bridge.desiredRunning) {
        this.resumeGame();
      }

      if (this.assetLoadFailed) {
        this.emitAnnouncement(
          "Alcuni disegni non sono disponibili: modalità grafica essenziale attiva.",
        );
      }
      this.emitSnapshot(true);
    }

    update(_time: number, delta: number) {
      if (bridge.destroyed) return;

      const safeDelta = Math.min(delta, 100);
      this.vfx?.update(safeDelta);

      if (bridge.input.pausePressed) {
        bridge.input.pausePressed = false;
        if (this.phase === "playing" || this.phase === "dying") this.pauseGame("Pausa");
        else if (this.phase === "paused") this.resumeGame();
      }

      if (this.phase !== "playing") {
        bridge.input.jumpPressed = false;
        bridge.input.firePressed = false;
        this.emitSnapshot();
        return;
      }

      this.elapsedMs += safeDelta;
      const gameTime = this.elapsedMs;
      this.updatePlayer(gameTime, safeDelta);
      this.updateMovingPlatforms(safeDelta);
      this.updateEnemies(gameTime);
      this.updateBosses(gameTime);
      this.updateProjectiles(gameTime);
      this.updateCamera();
      this.updateProgression();
      this.emitSnapshot();
    }

    pauseGame(reason = "Pausa") {
      if (this.phase !== "playing" && this.phase !== "dying") return;
      this.phaseBeforePause = this.phase;
      this.phase = "paused";
      this.statusText = reason;
      bridge.desiredRunning = false;
      this.physics.pause();
      this.time.paused = true;
      this.playerVisual?.pause();
      this.enemyVisuals.forEach((visual) => visual.pause());
      this.bossVisuals.forEach((visual) => visual.pause());
      this.vfx?.pause();
      this.aimReticle?.setVisible(false);
      this.emitSnapshot(true);
    }

    resumeGame() {
      if (this.phase === "game-over" || this.phase === "complete") return;
      this.time.paused = false;
      this.phase = this.phaseBeforePause === "dying" ? "dying" : "playing";
      this.statusText = CIRCLE_LEVELS[this.currentCircleIndex]?.title ?? "Sali";
      bridge.desiredRunning = true;
      this.physics.resume();
      this.playerVisual?.resume();
      this.enemyVisuals.forEach((visual) => visual.resume());
      this.bossVisuals.forEach((visual) => visual.resume());
      this.vfx?.resume();
      this.emitSnapshot(true);
    }

    restartGame(mode: "full-run" | "continue-act") {
      if (mode === "full-run") {
        this.time.paused = false;
        bridge.desiredRunning = true;
        this.scene.restart();
        return;
      }

      this.recordEligible = false;
      this.lives = 3;
      this.phase = "playing";
      this.statusText = "La salita continua — fuori classifica";
      bridge.desiredRunning = true;
      this.physics.resume();
      this.respawnAtActCheckpoint();
      this.emitAnnouncement("Continui dall'inizio dell'Atto. Record disattivato.");
      this.emitSnapshot(true);
    }

    setAssist(enabled: boolean) {
      bridge.assist = enabled;
      this.assistedRun = this.phase === "ready" ? enabled : this.assistedRun || enabled;
      this.movingPlatforms?.getChildren().forEach((child) => {
        if (isBodyObject(child)) child.setData("tuningMode", "pending");
      });
      this.enemies?.getChildren().forEach((child) => {
        if (!isBodyObject(child) || child.getData("defeated")) return;
        const kind = child.getData("kind") as EnemyKind;
        const targetHealth = this.tuning.enemies.health[kind];
        const currentHealth = child.getData("hp") as number;
        child.setData(
          "hp",
          this.phase === "ready" ? targetHealth : Math.min(currentHealth, targetHealth),
        );
      });
      this.bosses?.getChildren().forEach((child) => {
        if (!isBodyObject(child) || child.getData("defeated")) return;
        const id = child.getData("id") as BossId;
        const targetHealth = this.tuning.bosses.health[id];
        const currentHealth = child.getData("hp") as number;
        child.setData("maxHp", targetHealth);
        child.setData(
          "hp",
          this.phase === "ready" ? targetHealth : Math.min(currentHealth, targetHealth),
        );
      });
      this.bestMs = readBestTime(this.assistedRun);
      this.emitSnapshot(true);
    }

    setReducedMotion(enabled: boolean) {
      bridge.reducedMotion = enabled;
      this.vfx?.setReducedMotion(enabled);
    }

    setViewportSize(width: number, height: number) {
      this.viewportWidth = Math.max(GAME_WIDTH, Math.round(width));
      this.viewportHeight = Math.max(1, Math.round(height));
      this.worldGeometry = resolveRuntimeWorldGeometry(this.viewportWidth);
      const currentScrollY = this.cameras.main.scrollY;
      this.physics.world.setBounds(
        this.worldGeometry.left,
        0,
        this.worldGeometry.width,
        WORLD_HEIGHT,
      );
      this.cameras.main.setBounds(
        this.worldGeometry.left,
        0,
        this.worldGeometry.width,
        WORLD_HEIGHT,
      );
      this.cameras.main.scrollX = this.worldGeometry.left;
      this.cameras.main.scrollY = PhaserRuntime.Math.Clamp(
        currentScrollY,
        0,
        Math.max(0, WORLD_HEIGHT - this.viewportHeight),
      );
      this.adaptiveStaticGeometry.forEach((entry) => {
        if (!entry.object.active) return;
        const bounds = resolveAdaptiveHorizontalBounds({
          role: entry.role,
          authoredLeft: entry.authoredLeft,
          authoredRight: entry.authoredRight,
          geometry: this.worldGeometry,
        });
        entry.object
          .setPosition(bounds.centerX, entry.object.y)
          .setDisplaySize(bounds.width, entry.height);
        const body = entry.object.body as Phaser.Physics.Arcade.StaticBody | undefined;
        body?.updateFromGameObject();
        const visual = entry.object.getData("visual") as Phaser.GameObjects.Image | undefined;
        if (visual?.active && entry.visualHeight) {
          visual
            .setPosition(bounds.centerX, visual.y)
            .setDisplaySize(bounds.width, entry.visualHeight);
        }
      });
      this.backgroundTiles.forEach((tile) => {
        tile.setPosition(WORLD_WIDTH / 2, tile.y);
        tile.setSize(this.viewportWidth, LEVEL_HEIGHT);
        const sourceWidth = tile.getData("sourceWidth") as number | undefined;
        const sourceHeight = tile.getData("sourceHeight") as number | undefined;
        const transform = resolveBackgroundTileTransform({
          viewportWidth: this.viewportWidth,
          textureWidth: sourceWidth ?? 0,
          textureHeight: sourceHeight ?? 0,
        });
        tile
          .setTileScale(transform.scaleX, transform.scaleY)
          .setTilePosition(transform.positionX, transform.positionY);
      });
      this.backgroundWashes.forEach((wash) => {
        wash.setPosition(WORLD_WIDTH / 2, wash.y);
        wash.setDisplaySize(this.viewportWidth, LEVEL_HEIGHT);
      });

      if (this.player?.active && this.player.body) {
        const inset = this.tuning.player.width / 2 + 2;
        const nextX = PhaserRuntime.Math.Clamp(
          this.player.x,
          this.worldGeometry.left + inset,
          this.worldGeometry.right - inset,
        );
        if (nextX !== this.player.x) {
          this.player.setX(nextX);
          (this.player.body as Phaser.Physics.Arcade.Body).updateFromGameObject();
        }
      }
    }

    resolvePointerAim(viewportX: number, viewportY: number) {
      if (!this.player?.active) return null;
      const origin = this.getPlayerVerseOrigin();
      return resolvePointerAimVector({
        viewportX,
        viewportY,
        cameraScrollX: this.cameras.main.scrollX,
        cameraScrollY: this.cameras.main.scrollY,
        originX: origin.x,
        originY: origin.y,
      });
    }

    verifyCampaign() {
      if (process.env.NODE_ENV === "production") {
        throw new Error("Campaign verification is unavailable in production.");
      }

      CIRCLE_LEVELS.forEach((level, index) => {
        this.currentCircleIndex = index;
        if (level.checkpoint) this.checkpointActIndex = clampActIndex(level.actIndex);
        if (!level.boss || !this.hasLivingBoss(level.boss)) return;
        const boss = this.bosses.getChildren().find(
          (child) => isBodyObject(child) && child.getData("id") === level.boss,
        );
        if (boss && isBodyObject(boss)) {
          boss.setData("hp", 1);
          this.damageBoss(boss);
        }
      });
      this.elapsedMs = 240_000;
      this.player.setY(32);
      this.completeRun();
      return this.buildSnapshot();
    }

    async verifyDamageRespawn() {
      if (this.phase === "ready" || this.phase === "paused") this.resumeGame();
      if (this.phase !== "playing") {
        throw new Error(`Damage verification requires a playable scene, got ${this.phase}.`);
      }
      const livesBefore = this.lives;
      this.invulnerableUntil = 0;
      this.takeDamage("verifica runtime");
      await new Promise<void>((resolve) => this.time.delayedCall(900, resolve));
      const snapshot = this.buildSnapshot();
      if (snapshot.phase !== "playing" || snapshot.lives !== livesBefore - 1) {
        throw new Error(
          `Damage verification failed: phase=${snapshot.phase}, lives=${snapshot.lives}, expected=${livesBefore - 1}.`,
        );
      }
      return snapshot;
    }

    readTelemetry() {
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      const projectiles = this.playerProjectiles
        .getChildren()
        .filter((child): child is BodyObject => isBodyObject(child) && child.active);
      const latestProjectile = projectiles.at(-1);
      const projectileBody = latestProjectile?.body;

      return {
        phase: this.phase,
        breath: this.breath,
        circleId: CIRCLE_LEVELS[this.currentCircleIndex]?.id ?? "IX",
        aim: bridge.input.aim,
        player: {
          x: this.player.x,
          y: this.player.y,
          velocityX: body.velocity.x,
          velocityY: body.velocity.y,
          grounded: body.blocked.down || body.touching.down,
          facing: this.player.flipX ? -1 : 1,
        },
        projectile: {
          count: projectiles.length,
          velocityX:
            projectileBody instanceof PhaserRuntime.Physics.Arcade.Body
              ? projectileBody.velocity.x
              : null,
          velocityY:
            projectileBody instanceof PhaserRuntime.Physics.Arcade.Body
              ? projectileBody.velocity.y
              : null,
        },
        lastShot: this.lastShotTelemetry,
      } as const;
    }

    private queueActAssets(actIndex: 1 | 2) {
      if (this.loadedActs.has(actIndex) || this.loadingActs.has(actIndex)) return;
      const bossId: BossId = actIndex === 1 ? "pluto" : "charon";
      const theme = actIndex === 1 ? "dite" : "stelle";
      (["far", "mid", "near"] as const).forEach((layer) => {
        const key = `background-${theme}-${layer}`;
        if (!this.textures.exists(key)) {
          this.load.image(key, `/game/backgrounds/${theme}-${layer}.webp`);
        }
      });
      this.loadingActs.add(actIndex);
      this.load.once("complete", () => this.finishActAssetLoad(actIndex, bossId));
      this.load.start();
    }

    private finishActAssetLoad(actIndex: 1 | 2, bossId: BossId) {
      this.loadingActs.delete(actIndex);
      this.loadedActs.add(actIndex);
      registerActorAnimations(this);
      CIRCLE_LEVELS.filter((level) => level.actIndex === actIndex).forEach((level) => {
        this.createLevelBackground(level, getLevelWorldOffsetY(level.orderFromBottom));
      });
      const boss = this.bosses.getChildren().find(
        (child) => isDynamicBodyObject(child) && child.getData("id") === bossId,
      );
      if (!boss || !isDynamicBodyObject(boss) || !this.textures.exists(BOSS_TEXTURE)) return;
      const sprite = boss as Phaser.Physics.Arcade.Sprite;
      sprite.setTexture(BOSS_TEXTURE, 0).setDisplaySize(96, 96);
      this.setWorldHitbox(sprite, 63, 63);
      const current = this.bossVisuals.get(sprite);
      current?.destroy();
      this.bossVisuals.set(sprite, createBossVisualController(this, sprite, bossId));
    }

    private createGroups() {
      this.staticPlatforms = this.add.group();
      this.oneWayPlatforms = this.add.group();
      this.movingPlatforms = this.add.group();
      this.crumblePlatforms = this.add.group();
      this.enemies = this.physics.add.group();
      this.pickups = this.physics.add.group({ allowGravity: false });
      this.playerProjectiles = this.physics.add.group({
        allowGravity: false,
        maxSize: this.tuning.combat.maxProjectiles,
      });
      this.hostileProjectiles = this.physics.add.group({ allowGravity: false });
      this.bosses = this.physics.add.group({ allowGravity: false });
    }

    private createProceduralTextures() {
      const makeTexture = (
        key: string,
        width: number,
        height: number,
        draw: (graphics: Phaser.GameObjects.Graphics) => void,
      ) => {
        if (this.textures.exists(key)) return;
        const graphics = this.add.graphics();
        draw(graphics);
        graphics.generateTexture(key, width, height);
        graphics.destroy();
      };

      makeTexture("player-fallback", 48, 64, (graphics) => {
        graphics.fillStyle(0x16191e).fillRect(12, 12, 24, 40);
        graphics.fillStyle(0xf4a261).fillRect(16, 4, 18, 17);
        graphics.fillStyle(0x39f4ff).fillRect(31, 25, 12, 7);
        graphics.fillStyle(0xffffff).fillRect(14, 54, 10, 6);
        graphics.fillRect(28, 54, 10, 6);
      });
      makeTexture("verse-projectile", 7, 17, (graphics) => {
        graphics.fillStyle(0xffffff).fillRect(2, 0, 3, 17);
        graphics.fillStyle(0x39f4ff).fillRect(0, 3, 7, 10);
        graphics.fillStyle(0xff66c4).fillRect(2, 5, 3, 6);
      });
      makeTexture("noise-projectile", 9, 9, (graphics) => {
        graphics.fillStyle(0xff664f).fillRect(0, 2, 9, 5);
        graphics.fillStyle(0xffd166).fillRect(2, 0, 5, 9);
      });
      makeTexture("enemy", 28, 32, (graphics) => {
        graphics.fillStyle(0x151015).fillRect(3, 6, 22, 24);
        graphics.fillStyle(0xff664f).fillRect(6, 2, 16, 12);
        graphics.fillStyle(0xffe4be).fillRect(9, 6, 3, 3);
        graphics.fillRect(17, 6, 3, 3);
        graphics.fillStyle(0x92374d).fillRect(0, 27, 10, 5);
        graphics.fillRect(18, 27, 10, 5);
      });
      makeTexture("flyer", 32, 24, (graphics) => {
        graphics.fillStyle(0x7f5af0).fillTriangle(0, 12, 14, 2, 14, 22);
        graphics.fillTriangle(32, 12, 18, 2, 18, 22);
        graphics.fillStyle(0xffd166).fillRect(12, 6, 8, 12);
      });
      makeTexture("pickup-voice", 18, 18, (graphics) => {
        graphics.fillStyle(0x39f4ff).fillTriangle(9, 0, 18, 9, 9, 18);
        graphics.fillTriangle(9, 0, 0, 9, 9, 18);
        graphics.fillStyle(0xffffff).fillRect(7, 5, 4, 8);
      });
      makeTexture("pickup-breath", 18, 18, (graphics) => {
        graphics.fillStyle(0x76e6a6).fillCircle(9, 9, 8);
        graphics.fillStyle(0xffffff).fillCircle(7, 7, 3);
      });
      makeTexture("pickup-rima", 18, 18, (graphics) => {
        graphics.fillStyle(0xff7fd1).fillRect(2, 2, 14, 14);
        graphics.fillStyle(0xffffff).fillRect(7, 0, 4, 18);
      });
      makeTexture("pickup-light", 18, 18, (graphics) => {
        graphics.fillStyle(0xffed8a).fillCircle(9, 9, 8);
        graphics.fillStyle(0xffffff).fillCircle(9, 9, 3);
      });
      makeTexture("boss-fallback", 96, 72, (graphics) => {
        graphics.fillStyle(0x2c1523).fillRect(7, 11, 82, 55);
        graphics.fillStyle(0xff664f).fillRect(18, 0, 60, 31);
        graphics.fillStyle(0xffd166).fillRect(24, 12, 12, 8);
        graphics.fillRect(60, 12, 12, 8);
      });
    }

    private buildLevel(level: CircleLevelDefinition, index: number) {
      const offsetY = getLevelWorldOffsetY(level.orderFromBottom);
      const palette = ACT_PALETTES[level.actIndex];
      this.createLevelBackground(level, offsetY);
      const wash = this.add
        .rectangle(
          WORLD_WIDTH / 2,
          offsetY + LEVEL_HEIGHT / 2,
          this.viewportWidth,
          LEVEL_HEIGHT,
          palette.sky,
          0.2,
        )
        .setDepth(-18);
      this.backgroundWashes.add(wash);
      this.add
        .text(18, offsetY + LEVEL_HEIGHT - 72, level.title.toUpperCase(), {
          fontFamily: "monospace",
          fontSize: "13px",
          color: "#ffffff",
          letterSpacing: 2,
        })
        .setAlpha(0.72)
        .setDepth(-4);

      this.createCircleMechanicVisuals(level, offsetY, palette);

      let enemyCounter = index;
      for (let row = 0; row < level.rows.length; row += 1) {
        const rowData = level.rows[row];
        for (let column = 0; column < rowData.length; column += 1) {
          const symbol = rowData[column];
          const x = column * TILE_SIZE + TILE_SIZE / 2;
          const y = offsetY + row * TILE_SIZE + TILE_SIZE / 2;

          if (symbol === "#" || symbol === "-" || symbol === "C") {
            let run = 1;
            while (rowData[column + run] === symbol) run += 1;
            const authoredLeft = column * TILE_SIZE;
            const authoredRight = (column + run) * TILE_SIZE;
            const touchesLeft = column === 0;
            const touchesRight = column + run === rowData.length;
            const isFloor = row === level.rows.length - 1;
            const adaptiveRole: AdaptiveHorizontalRole =
              symbol !== "#" || (!touchesLeft && !touchesRight)
                ? "fixed"
                : isFloor && touchesLeft && touchesRight
                  ? "fill"
                  : isFloor && touchesLeft
                    ? "extend-left"
                    : isFloor && touchesRight
                      ? "extend-right"
                      : touchesLeft
                        ? "pin-left"
                        : "pin-right";
            const horizontalBounds = resolveAdaptiveHorizontalBounds({
              role: adaptiveRole,
              authoredLeft,
              authoredRight,
              geometry: this.worldGeometry,
            });
            this.createPlatform(
              horizontalBounds.centerX,
              y,
              horizontalBounds.width,
              level.actIndex,
              symbol === "#" ? "static" : symbol === "-" ? "one-way" : "crumble",
              level,
              row,
              adaptiveRole === "fixed"
                ? undefined
                : { role: adaptiveRole, authoredLeft, authoredRight },
            );
            column += run - 1;
            continue;
          }

          if (symbol === "H" || symbol === "V") {
            this.createMovingPlatform(x, y, level.actIndex, symbol === "H" ? "x" : "y");
          } else if (symbol === "S") {
            const spawn = new PhaserRuntime.Math.Vector2(x, y - 30);
            this.circleSpawns.set(index, spawn);
            if (level.checkpoint) {
              this.checkpointSpawns.set(level.actIndex, spawn.clone());
            }
          } else if (symbol === "E") {
            this.createEnemy(x, y - 10, ENEMY_KINDS[enemyCounter % ENEMY_KINDS.length], level.actIndex);
            enemyCounter += 1;
          } else if (symbol === "F") {
            this.createEnemy(x, y, "flyer", level.actIndex);
          } else if (symbol === "P") {
            this.createPickup(x, y, "voice");
          } else if (symbol === "B") {
            this.createPickup(x, y, "breath");
          } else if (symbol === "R") {
            this.createPickup(x, y, "rima");
          } else if (symbol === "L") {
            this.createPickup(x, y, "light");
          } else if (symbol === "X" && level.boss) {
            this.createBoss(x, y + 24, level.boss, level.actIndex, offsetY);
          }
        }
      }
    }

    private createCircleMechanicVisuals(
      level: CircleLevelDefinition,
      offsetY: number,
      palette: (typeof ACT_PALETTES)[number],
    ) {
      const addLabel = (x: number, y: number, label: string, color: string) => {
        this.add
          .text(x, offsetY + y, label, {
            fontFamily: "monospace",
            fontSize: "8px",
            color,
            letterSpacing: 1,
          })
          .setAlpha(0.58)
          .setDepth(-2);
      };

      if (level.mechanics.includes("switches")) {
        [210, 520, 820].forEach((y, index) => {
          this.add.rectangle(index % 2 === 0 ? 34 : 350, offsetY + y, 10, 18, palette.accent, 0.9).setDepth(-1);
        });
        addLabel(18, 188, "SIGILLI", "#39f4ff");
      }
      if (level.mechanics.includes("chains")) {
        [76, 192, 308].forEach((x) => {
          this.add.rectangle(x, offsetY + 470, 3, 740, palette.shadow, 0.75).setDepth(-3);
        });
        addLabel(18, 260, "CATENE / ASCENSORI", "#f4f0e8");
      }
      if (level.mechanics.includes("gates") || level.mechanics.includes("tombs")) {
        [220, 510, 800].forEach((y) => {
          this.add.rectangle(GAME_WIDTH / 2, offsetY + y, 228, 54, palette.shadow, 0.46).setDepth(-3);
          this.add.rectangle(GAME_WIDTH / 2, offsetY + y - 22, 218, 5, palette.accent, 0.5).setDepth(-2);
        });
        addLabel(18, 176, "PORTE DI DITE", "#ffd166");
      }
      if (level.mechanics.includes("rafts")) {
        [300, 620, 860].forEach((y) => {
          this.add.rectangle(GAME_WIDTH / 2, offsetY + y, GAME_WIDTH, 22, 0x39f4ff, 0.12).setDepth(-5);
        });
        addLabel(18, 206, "ZATTERE SULLO STIGE", "#39f4ff");
      }
    }

    private createLevelBackground(level: CircleLevelDefinition, offsetY: number) {
      if (this.backgroundLevelsDrawn.has(level.id)) return;
      const actKey = level.actIndex === 0 ? "giudecca" : level.actIndex === 1 ? "dite" : "stelle";
      if (!( ["far", "mid", "near"] as const).every((layer) => this.textures.exists(`background-${actKey}-${layer}`))) {
        return;
      }
      this.backgroundLevelsDrawn.add(level.id);
      (["far", "mid", "near"] as const).forEach((layer, layerIndex) => {
        const key = `background-${actKey}-${layer}`;
        if (!this.textures.exists(key)) return;
        const tile = this.add.tileSprite(
          WORLD_WIDTH / 2,
          offsetY + LEVEL_HEIGHT / 2,
          this.viewportWidth,
          LEVEL_HEIGHT,
          key,
        );
        const source = this.textures.getFrame(key)?.source;
        const sourceWidth = source?.width ?? GAME_WIDTH * 2;
        const sourceHeight = source?.height ?? LEVEL_HEIGHT * 2;
        const transform = resolveBackgroundTileTransform({
          viewportWidth: this.viewportWidth,
          textureWidth: sourceWidth,
          textureHeight: sourceHeight,
        });
        tile
          .setData("sourceWidth", sourceWidth)
          .setData("sourceHeight", sourceHeight)
          .setTileScale(transform.scaleX, transform.scaleY)
          .setTilePosition(transform.positionX, transform.positionY);
        tile.setAlpha([0.48, 0.44, 0.32][layerIndex]);
        tile.setDepth(-30 + layerIndex * 3);
        this.backgroundTiles.add(tile);
      });
    }

    private createPlatform(
      x: number,
      y: number,
      width: number,
      actIndex: 0 | 1 | 2,
      kind: "static" | "one-way" | "crumble",
      level: CircleLevelDefinition,
      row: number,
      adaptive?: Readonly<{
        role: Exclude<AdaptiveHorizontalRole, "fixed">;
        authoredLeft: number;
        authoredRight: number;
      }>,
    ) {
      const falsePlatform =
        kind === "crumble" &&
        level.mechanics.includes("false-platforms") &&
        row % 8 === 0;
      const palette = ACT_PALETTES[actIndex];
      const height = kind === "one-way" ? 8 : 14;
      const color = kind === "crumble" ? palette.accent : palette.platform;
      const authoredVisual = this.textures.exists("platform-v2") && width >= 32;
      const platform = this.add.rectangle(
        x,
        y,
        width,
        height,
        color,
        authoredVisual ? 0.12 : kind === "one-way" ? 0.72 : 0.95,
      );
      platform.setStrokeStyle(2, palette.shadow, authoredVisual ? 0.4 : 1).setDepth(1);
      this.physics.add.existing(platform, true);
      platform.setData({
        kind,
        row,
        levelOrderFromBottom: level.orderFromBottom,
      });
      let visualHeight: number | null = null;
      if (authoredVisual) {
        const frame = actIndex * 8 + (kind === "crumble" ? 2 : kind === "one-way" ? 1 : 0);
        visualHeight = Math.max(18, height + 12);
        const visual = this.add
          .image(x, y - (kind === "one-way" ? 1 : 3), "platform-v2", frame)
          .setDisplaySize(width, visualHeight)
          .setDepth(2);
        platform.setData("visual", visual);
      }
      if (adaptive) {
        this.adaptiveStaticGeometry.add({
          object: platform,
          role: adaptive.role,
          authoredLeft: adaptive.authoredLeft,
          authoredRight: adaptive.authoredRight,
          height,
          visualHeight,
        });
      }
      if (falsePlatform) {
        platform.setAlpha(0.36).setData("falsePlatform", true);
        const falseBody = platform.body as Phaser.Physics.Arcade.StaticBody;
        falseBody.enable = false;
      } else if (kind === "one-way") this.oneWayPlatforms.add(platform);
      else if (kind === "crumble") this.crumblePlatforms.add(platform);
      else this.staticPlatforms.add(platform);
    }

    private createMovingPlatform(
      x: number,
      y: number,
      actIndex: 0 | 1 | 2,
      axis: "x" | "y",
    ) {
      const platformTuning = this.tuning.platforms;
      const palette = ACT_PALETTES[actIndex];
      const platform = this.add.rectangle(
        x,
        y,
        platformTuning.movingWidth,
        12,
        palette.accent,
        0.92,
      );
      const authoredVisual = this.textures.exists("platform-v2");
      platform
        .setAlpha(authoredVisual ? 0.12 : 0.92)
        .setStrokeStyle(2, 0xffffff, authoredVisual ? 0.35 : 0.55)
        .setDepth(1);
      this.physics.add.existing(platform);
      const body = platform.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(false).setImmovable(true).setMaxVelocity(62, 62);
      platform.setData({
        kind: "moving",
        axis,
        originX: x,
        originY: y,
        direction: axis === "x" ? 1 : -1,
        range:
          axis === "x"
            ? platformTuning.horizontalRange
            : platformTuning.verticalRange,
        lastX: x,
        lastY: y,
        tuningMode: bridge.assist ? "assist" : "standard",
      });
      if (authoredVisual) {
        const visual = this.add
          .image(x, y - 2, "platform-v2", actIndex * 8 + (axis === "x" ? 3 : 4))
          .setDisplaySize(platformTuning.movingWidth, 24)
          .setDepth(2);
        platform.setData("visual", visual);
      }
      if (axis === "x") body.setVelocityX(platformTuning.horizontalSpeed);
      else body.setVelocityY(-platformTuning.verticalSpeed);
      this.movingPlatforms.add(platform);
    }

    private createEnemy(x: number, y: number, kind: EnemyKind, actIndex: 0 | 1 | 2) {
      const authored = this.textures.exists(ENEMY_TEXTURE);
      const texture = authored ? ENEMY_TEXTURE : kind === "flyer" ? "flyer" : "enemy";
      const enemy = this.physics.add.sprite(x, y, texture, 0);
      if (authored) {
        const visual = createEnemyVisualController(this, enemy, kind);
        visual.play(kind === "sentry" ? "idle" : "move");
        this.enemyVisuals.set(enemy, visual);
        enemy.once("destroy", () => this.enemyVisuals.delete(enemy));
      }
      enemy.setDepth(5).setData({
        kind,
        hp: this.tuning.enemies.health[kind],
        originX: x,
        originY: y,
        direction: x < GAME_WIDTH / 2 ? 1 : -1,
        nextAttackAt: Number.POSITIVE_INFINITY,
        engaged: false,
        seed: (x * 13 + y * 7) % 1000,
        actIndex,
      });
      const body = enemy.body as Phaser.Physics.Arcade.Body;
      if (authored) {
        const targetWidth = kind === "flyer" ? 26 : 22;
        const targetHeight = kind === "flyer" ? 18 : 28;
        body.setSize(
          Math.round((enemy.frame.realWidth * targetWidth) / enemy.displayWidth),
          Math.round((enemy.frame.realHeight * targetHeight) / enemy.displayHeight),
          true,
        );
      } else {
        body.setSize(kind === "flyer" ? 26 : 22, kind === "flyer" ? 18 : 28);
      }
      body.setAllowGravity(kind !== "flyer" && kind !== "sentry");
      body.setMaxVelocity(120, this.tuning.player.maxFallVelocity);
      if (kind === "sentry") body.setImmovable(true);
      this.enemies.add(enemy);
    }

    private createPickup(x: number, y: number, kind: PickupKind) {
      const pickup = this.physics.add.sprite(x, y, `pickup-${kind}`);
      pickup.setDepth(7).setData({ kind, originY: y, seed: x + y });
      (pickup.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setSize(16, 16);
      this.pickups.add(pickup);
    }

    private createBoss(
      x: number,
      y: number,
      id: BossId,
      actIndex: 0 | 1 | 2,
      levelOffsetY: number,
    ) {
      const texture = this.textures.exists(BOSS_TEXTURE) ? BOSS_TEXTURE : "boss-fallback";
      const boss = this.physics.add.sprite(x, y, texture, 0);
      const maxHealth = this.tuning.bosses.health[id];
      const authored = texture !== "boss-fallback";
      if (authored) {
        const visual = createBossVisualController(this, boss, id);
        this.bossVisuals.set(boss, visual);
        boss.once("destroy", () => this.bossVisuals.delete(boss));
      }
      boss.setDepth(8).setData({
        id,
        hp: maxHealth,
        maxHp: maxHealth,
        originX: x,
        originY: y,
        nextAttackAt: Number.POSITIVE_INFINITY,
        active: false,
        actIndex,
      });
      const body = boss.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(false).setImmovable(true);
      if (authored) this.setWorldHitbox(boss, 63, 63);
      else body.setSize(78, 58, true);
      this.bosses.add(boss);

      const palette = ACT_PALETTES[actIndex];
      const gateBounds = resolveAdaptiveHorizontalBounds({
        role: "fill",
        authoredLeft: 0,
        authoredRight: GAME_WIDTH,
        geometry: this.worldGeometry,
      });
      const gate = this.add.rectangle(
        gateBounds.centerX,
        levelOffsetY + 32,
        gateBounds.width,
        14,
        palette.accent,
        0.8,
      );
      gate.setDepth(4).setData("bossId", id);
      this.physics.add.existing(gate, true);
      this.adaptiveStaticGeometry.add({
        object: gate,
        role: "fill",
        authoredLeft: 0,
        authoredRight: GAME_WIDTH,
        height: 14,
        visualHeight: null,
      });
      this.staticPlatforms.add(gate);
      this.bossGates.set(id, gate);
    }

    private createPlayer(x: number, y: number) {
      this.authoredPlayer = this.textures.exists(PLAYER_TEXTURE);
      this.player = this.physics.add.sprite(x, y, this.authoredPlayer ? PLAYER_TEXTURE : "player-fallback", 0);
      this.player.setDepth(12).setCollideWorldBounds(true);
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      const playerTuning = this.tuning.player;
      if (this.authoredPlayer) {
        this.playerVisual = createPlayerVisualController(this, this.player);
        const sourceHitbox = resolveSourceHitbox(
          playerTuning.width,
          playerTuning.height,
          this.player.scaleX,
          this.player.scaleY,
        );
        body.setSize(sourceHitbox.width, sourceHitbox.height, true);
        body.setOffset(
          PLAYER_VISUAL.pivot.x - sourceHitbox.width / 2,
          PLAYER_VISUAL.pivot.y - sourceHitbox.height,
        );
      } else {
        this.player.setOrigin(0.5, 0.90625);
        body.setSize(playerTuning.width, playerTuning.height, true);
        body.setOffset(13, 26);
      }
      body.setMaxVelocity(playerTuning.speed, playerTuning.maxFallVelocity);
    }

    private createCollisions() {
      this.physics.add.collider(this.player, this.staticPlatforms, (_player, platform) => {
        if (isBodyObject(platform)) this.rememberStableSpawn(platform);
      });
      this.physics.add.collider(this.player, this.movingPlatforms, (_player, platform) => {
        if (isBodyObject(platform)) {
          this.lastMovingPlatform = platform;
          this.rememberStableSpawn(platform);
        }
      });
      this.physics.add.collider(
        this.player,
        this.oneWayPlatforms,
        (_player, platform) => {
          if (isBodyObject(platform)) this.rememberStableSpawn(platform);
        },
        (player, platform) => this.shouldCollideOneWay(player, platform),
      );
      this.physics.add.collider(this.player, this.crumblePlatforms, (_player, platform) => {
        if (isBodyObject(platform)) this.armCrumblePlatform(platform);
      });
      this.physics.add.collider(this.enemies, this.staticPlatforms);
      this.physics.add.collider(
        this.enemies,
        this.oneWayPlatforms,
        undefined,
        (enemy, platform) => this.shouldCollideOneWay(enemy, platform),
      );
      this.physics.add.overlap(this.player, this.enemies, () => this.takeDamage("Rumore"));
      this.physics.add.overlap(this.player, this.bosses, () => this.takeDamage("Custode"));
      this.physics.add.overlap(this.player, this.hostileProjectiles, (_player, projectile) => {
        if (isBodyObject(projectile)) {
          this.vfx?.playWorld("noise-impact", projectile.x, projectile.y);
          projectile.destroy();
        }
        this.takeDamage("Frammento ostile");
      });
      this.physics.add.overlap(this.player, this.pickups, (_player, pickup) => {
        if (isBodyObject(pickup)) this.collectPickup(pickup);
      });
      this.physics.add.overlap(this.playerProjectiles, this.enemies, (projectile, enemy) => {
        if (isBodyObject(projectile)) {
          this.vfx?.playWorld("verse-impact", projectile.x, projectile.y);
          projectile.destroy();
        }
        if (isBodyObject(enemy)) this.damageEnemy(enemy);
      });
      this.physics.add.overlap(this.playerProjectiles, this.bosses, (projectile, boss) => {
        if (isBodyObject(projectile)) {
          this.vfx?.playWorld("verse-impact", projectile.x, projectile.y, { scale: 1.18 });
          projectile.destroy();
        }
        if (isBodyObject(boss)) this.damageBoss(boss);
      });
      [
        this.staticPlatforms,
        this.oneWayPlatforms,
        this.movingPlatforms,
        this.crumblePlatforms,
      ].forEach((platforms) => {
        this.physics.add.collider(
          this.hostileProjectiles,
          platforms,
          (projectile) => {
            if (isBodyObject(projectile)) this.dissolveHostileProjectile(projectile);
          },
        );
      });
    }

    private rememberStableSpawn(platform: BodyObject) {
      if (!this.player?.body || !platform.body.enable) return;
      const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
      if (playerBody.velocity.y < 0 || playerBody.bottom > platform.body.top + 14) return;
      this.lastStableSpawn = new PhaserRuntime.Math.Vector2(
        PhaserRuntime.Math.Clamp(
          this.player.x,
          this.worldGeometry.left + 24,
          this.worldGeometry.right - 24,
        ),
        this.player.y - 2,
      );
      this.lastStablePlatform = platform;
      this.lastStablePlatformOffset = new PhaserRuntime.Math.Vector2(
        this.lastStableSpawn.x - platform.x,
        this.lastStableSpawn.y - platform.y,
      );
    }

    private resolveLastStableSpawn() {
      const platform = this.lastStablePlatform;
      const offset = this.lastStablePlatformOffset;
      if (
        platform?.active &&
        platform.body?.enable &&
        offset
      ) {
        const resolved = resolveStablePlatformPosition({
          platformX: platform.x,
          platformY: platform.y,
          platformLeft: platform.body.left,
          platformRight: platform.body.right,
          offsetX: offset.x,
          offsetY: offset.y,
          playerWidth: this.tuning.player.width,
          worldWidth: this.worldGeometry.width,
          worldLeft: this.worldGeometry.left,
        });
        return new PhaserRuntime.Math.Vector2(resolved.x, resolved.y);
      }
      return this.lastStableSpawn?.clone() ?? null;
    }

    private dissolveHostileProjectile(projectile: BodyObject) {
      if (!projectile.active) return;
      this.vfx?.playWorld("noise-impact", projectile.x, projectile.y);
      projectile.destroy();
    }

    private shouldCollideOneWay(
      moving: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile,
      platform: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile,
    ) {
      if (!isDynamicBodyObject(moving) || !isBodyObject(platform)) return false;
      const body = moving.body;
      if (
        moving === this.player &&
        platform.body instanceof PhaserRuntime.Physics.Arcade.StaticBody &&
        platform.getData("kind") === "one-way" &&
        platform.getData("levelOrderFromBottom") === 0 &&
        platform.getData("row") === 3 &&
        body.velocity.y < 0 &&
        body.right > platform.body.left + 2 &&
        body.left < platform.body.right - 2 &&
        body.bottom <= platform.body.top + 28
      ) {
        body.setVelocityY(0);
        body.y = platform.body.top - body.height - 1;
        return true;
      }
      const platformVelocityY =
        platform.body instanceof PhaserRuntime.Physics.Arcade.Body
          ? platform.body.velocity.y
          : 0;
      return shouldCollideOneWayRule({
        actorBottom: body.bottom,
        actorVelocityY: body.velocity.y,
        platformTop: platform.body.top,
        platformVelocityY,
        tolerance: this.tuning.platforms.oneWayTolerance,
      });
    }

    private armCrumblePlatform(platform: BodyObject) {
      if (platform.getData("armed")) return;
      const platformTuning = this.tuning.platforms;
      platform.setData("armed", true);
      this.time.delayedCall(platformTuning.crumbleDelayMs, () => {
        if (!platform.active) return;
        platform.setVisible(false);
        const visual = platform.getData("visual") as Phaser.GameObjects.Image | undefined;
        visual?.setVisible(false);
        platform.body.enable = false;
        this.time.delayedCall(platformTuning.crumbleRestoreMs, () => {
          if (!platform.active) return;
          platform.setVisible(true);
          visual?.setVisible(true);
          platform.body.enable = true;
          platform.setData("armed", false);
        });
      });
    }

    private updateMovingPlatforms(delta: number) {
      const platformTuning = this.tuning.platforms;
      const tuningMode = bridge.assist ? "assist" : "standard";
      this.movingPlatforms.getChildren().forEach((child) => {
        if (!isDynamicBodyObject(child)) return;
        const axis = child.getData("axis") as "x" | "y";
        if (child.getData("tuningMode") !== tuningMode) {
          child.setData("tuningMode", tuningMode);
          child.setData(
            "range",
            axis === "x"
              ? platformTuning.horizontalRange
              : platformTuning.verticalRange,
          );
          child.setDisplaySize(platformTuning.movingWidth, 12);
          child.body.setSize(platformTuning.movingWidth, 12, true);
          const authoredVisual = child.getData("visual") as
            | Phaser.GameObjects.Image
            | undefined;
          authoredVisual?.setDisplaySize(platformTuning.movingWidth, 24);
        }
        const origin = axis === "x" ? (child.getData("originX") as number) : (child.getData("originY") as number);
        const coordinate = axis === "x" ? child.x : child.y;
        const range = child.getData("range") as number;
        const body = child.body;
        const speed =
          axis === "x"
            ? platformTuning.horizontalSpeed
            : platformTuning.verticalSpeed;
        const next = advanceMovingPlatform(
          {
            position: coordinate,
            origin,
            direction: child.getData("direction") as -1 | 1,
            range,
            speed,
          },
          delta,
        );
        child.setData("direction", next.direction);
        const velocity =
          delta > 0 ? ((next.position - coordinate) * 1_000) / delta : 0;
        if (axis === "x") body.setVelocity(velocity, 0);
        else body.setVelocity(0, velocity);
        child.setData("lastX", child.x);
        child.setData("lastY", child.y);
        const visual = child.getData("visual") as Phaser.GameObjects.Image | undefined;
        if (visual?.active) visual.setPosition(child.x, child.y - 2);
      });
    }

    private updatePlayer(time: number, delta: number) {
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      const tuning = this.tuning;
      const playerTuning = tuning.player;
      const mechanicTuning = tuning.mechanics;
      body.setMaxVelocity(playerTuning.speed, playerTuning.maxFallVelocity);
      body.setGravityY(
        playerTuning.gravity - getDifficultyTuning(false).player.gravity,
      );
      const mechanics = CIRCLE_LEVELS[this.currentCircleIndex]?.mechanics ?? [];
      const stickyGround = mechanics.includes("sticky") && (body.blocked.down || body.touching.down);
      const targetSpeed =
        bridge.input.moveX *
        playerTuning.speed *
        (stickyGround ? mechanicTuning.stickySpeedScale : 1);
      if (mechanics.includes("ice") && (body.blocked.down || body.touching.down)) {
        body.setVelocityX(
          PhaserRuntime.Math.Linear(
            body.velocity.x,
            targetSpeed,
            mechanicTuning.iceResponsiveness,
          ),
        );
      } else {
        body.setVelocityX(targetSpeed);
      }
      if (mechanics.includes("wind") && !body.blocked.down) {
        body.setVelocityX(
          body.velocity.x + Math.sin(time / 410) * mechanicTuning.windForce,
        );
      }
      if (mechanics.includes("knockback") && !body.blocked.down) {
        body.setVelocityX(
          body.velocity.x + Math.sin(time / 260) * mechanicTuning.knockbackForce,
        );
      }
      if (mechanics.includes("rain") && !body.blocked.down) {
        body.setVelocityY(
          Math.min(
            playerTuning.maxFallVelocity,
            body.velocity.y + delta * mechanicTuning.rainForce,
          ),
        );
      }
      const aimFacing = resolveAimFacingDirection(
        bridge.input.aim,
        body.velocity.x,
        this.player.flipX,
      );
      if (bridge.input.aim || bridge.input.moveX !== 0) {
        this.player.setFlipX(aimFacing < 0);
      }
      this.updateAimReticle(bridge.input.aim);

      const grounded = body.blocked.down || body.touching.down;
      if (grounded && !this.wasGrounded && body.velocity.y >= 0) {
        const hardLanding = this.lastAirborneVelocityY > 420;
        this.landedUntil = time + 150;
        this.playerVisual?.play("land");
        this.vfx?.playWorld(
          hardLanding ? "landing-hard" : "landing-soft",
          this.player.x,
          this.player.y + 5,
          { flipX: this.player.flipX },
        );
        this.emitAudio(hardLanding ? "land-hard" : "land");
      }
      if (!grounded) this.lastAirborneVelocityY = Math.max(this.lastAirborneVelocityY, body.velocity.y);
      else this.lastAirborneVelocityY = 0;
      this.wasGrounded = grounded;

      const jumpFrame = resolveJumpFrame({
        state: this.jumpWindowState,
        nowMs: time,
        grounded,
        jumpPressed: bridge.input.jumpPressed,
        jumpHeld: bridge.input.jumpHeld,
        velocityY: body.velocity.y,
        coyoteMs: playerTuning.coyoteMs,
        jumpBufferMs: playerTuning.jumpBufferMs,
        jumpVelocity: playerTuning.jumpVelocity,
        cutMultiplier: playerTuning.jumpCutMultiplier,
      });
      bridge.input.jumpPressed = false;
      this.jumpWindowState = jumpFrame.state;
      if (jumpFrame.velocityY !== body.velocity.y) {
        body.setVelocityY(jumpFrame.velocityY);
      }
      if (jumpFrame.jumped) {
        this.playerVisual?.play("jump-start");
        this.emitAudio("jump");
      }

      if (bridge.input.firePressed || bridge.input.fireHeld) this.tryFire(time);
      bridge.input.firePressed = false;
      this.breath = recoverBreath({
        breath: this.breath,
        maxBreath: tuning.combat.maxBreath,
        lastShotAtMs: this.lastShotAt,
        nowMs: time,
        deltaMs: delta,
        rechargeDelayMs: tuning.combat.rechargeDelayMs,
        rechargePerSecond: tuning.combat.rechargePerSecond,
      });

      if (time < this.invulnerableUntil) {
        this.player.setAlpha(Math.floor(time / 80) % 2 === 0 ? 0.34 : 1);
      } else {
        this.player.setAlpha(1).clearTint();
      }

      if (this.lastMovingPlatform && grounded && isBodyObject(this.lastMovingPlatform)) {
        const platform = this.lastMovingPlatform;
        const lastX = platform.getData("lastX") as number | undefined;
        if (lastX !== undefined) this.player.x += platform.x - lastX;
      }
      this.lastMovingPlatform = null;

      this.updatePlayerAnimation(time, grounded);
      if (this.player.y > this.cameras.main.scrollY + this.viewportHeight + 68) {
        this.takeDamage("Caduta", true);
      }
    }

    private updateAimReticle(
      aim: Readonly<{ x: number; y: number }> | null | undefined,
    ) {
      if (!this.aimReticle) return;
      const magnitude = aim ? Math.hypot(aim.x, aim.y) : 0;
      if (!aim || !Number.isFinite(magnitude) || magnitude < 0.01) {
        this.aimReticle.setVisible(false);
        return;
      }
      const unitX = aim.x / magnitude;
      const unitY = aim.y / magnitude;
      this.aimReticle
        .setPosition(
          this.player.x + unitX * 38,
          this.player.y - 31 + unitY * 38,
        )
        .setVisible(true);
    }

    private updatePlayerAnimation(time: number, grounded: boolean) {
      if (!this.authoredPlayer || !this.playerVisual) return;
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      const firing = time - this.lastShotAt < 150;
      let state: PlayerVisualState = "idle";
      if (this.phase === "dying" && time + 280 >= this.hitUntil) state = "defeat";
      else if (time < this.hitUntil) state = "hit";
      else if (time < this.landedUntil) state = "land";
      else if (firing) {
        state = this.lastShotWasDirectional
          ? "fire-diagonal"
          : grounded
            ? "fire-up-ground"
            : "fire-up-air";
      }
      else if (!grounded) state = body.velocity.y < 0 ? "jump" : "fall";
      else if (Math.abs(body.velocity.x) > 8) state = "run";
      this.playerVisual.play(state);
    }

    private tryFire(time: number) {
      const combat = this.tuning.combat;
      if (time - this.lastShotAt < combat.fireIntervalMs) return;
      const breathAfterShot = spendBreath(this.breath, combat.shotCost);
      if (!breathAfterShot.spent) {
        if (time >= this.nextEmptyBreathFeedbackAt) {
          this.nextEmptyBreathFeedbackAt = time + combat.emptyBreathFeedbackMs;
          this.statusText = "FIATO esaurito — attendi un istante";
          this.emitAnnouncement(this.statusText);
          this.emitSnapshot(true);
        }
        return;
      }
      if (this.playerProjectiles.countActive(true) >= combat.maxProjectiles) return;
      this.lastShotAt = time;
      this.breath = breathAfterShot.breath;
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      const facingDirection = resolveFacingDirection(body.velocity.x, this.player.flipX);
      const trajectory = resolveVerseTrajectory({
        moveX: bridge.input.moveX,
        facingDirection,
        projectileSpeed: combat.projectileSpeed,
        aim: bridge.input.aim,
      });
      const { direction, angleDegrees: baseAngle } = trajectory;
      this.lastShotWasDirectional = isDirectionalVerseAngle(baseAngle);
      const angles = time < this.rimaUntil ? [baseAngle - 10, baseAngle, baseAngle + 10] : [baseAngle];
      const baseRadians = PhaserRuntime.Math.DegToRad(baseAngle);
      const socketRadius = 19;
      const origin = this.getPlayerVerseOrigin();
      const socketX = origin.x + Math.cos(baseRadians) * socketRadius;
      const socketY = origin.y + Math.sin(baseRadians) * socketRadius;
      this.lastShotSequence += 1;
      this.lastShotTelemetry = {
        sequence: this.lastShotSequence,
        originX: socketX,
        originY: socketY,
        velocityX: trajectory.velocityX,
        velocityY: trajectory.velocityY,
        angleDegrees: baseAngle,
      };
      this.vfx?.playWorld("verse-muzzle", socketX, socketY, {
        rotation: PhaserRuntime.Math.DegToRad(baseAngle),
        flipX: direction < 0,
      });
      angles.forEach((angle) => {
        const radians = PhaserRuntime.Math.DegToRad(angle);
        const projectile = this.physics.add.sprite(socketX, socketY, "verse-projectile");
        const recipe = this.vfx?.applyProjectileVisual(projectile, "verse", 0);
        if (recipe) projectile.setDisplaySize(recipe.recommendedDisplaySize.width, recipe.recommendedDisplaySize.height);
        projectile
          .setDepth(11)
          .setRotation(radians + (recipe?.rotationOffset ?? Math.PI / 2))
          .setData({
            expiresAt: time + combat.projectileLifetimeMs,
            bornAt: time,
            projectileKind: "verse",
            lastTrailAt: time,
          });
        const projectileBody = projectile.body as Phaser.Physics.Arcade.Body;
        const hitbox = resolveVerseHitbox(angle, Boolean(recipe?.usesAtlas));
        this.setWorldHitbox(projectile, hitbox.width, hitbox.height);
        this.playerProjectiles.add(projectile);
        projectileBody.setAllowGravity(false).setVelocity(
          Math.cos(radians) * combat.projectileSpeed,
          Math.sin(radians) * combat.projectileSpeed,
        );
      });
      this.emitAudio("verse");
    }

    private getPlayerVerseOrigin() {
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      const grounded = body.blocked.down || body.touching.down;
      return {
        x: this.player.x,
        y: this.player.y - (grounded ? 33 : 31),
      } as const;
    }

    private updateEnemies(time: number) {
      this.pickups.getChildren().forEach((child) => {
        if (!isDynamicBodyObject(child)) return;
        const originY = child.getData("originY") as number;
        const seed = child.getData("seed") as number;
        child.body.setVelocityY(Math.sin((time + seed) / 350) * 9);
        if (Math.abs(child.y - originY) > 8) child.y = originY;
      });

      this.enemies.getChildren().forEach((child) => {
        if (!isDynamicBodyObject(child) || !child.active) return;
        const body = child.body;
        const enemyTuning = this.tuning.enemies;
        const engaged = this.isActorEngaged(
          child.y,
          enemyTuning.engagementDistance,
        );
        if (!engaged) {
          if (child.getData("kind") === "flyer" || child.getData("kind") === "sentry") {
            body.setVelocity(0, 0);
          } else {
            body.setVelocityX(0);
          }
          child.setData("engaged", false);
          return;
        }
        const kind = child.getData("kind") as EnemyKind;
        const direction = child.getData("direction") as number;
        const originX = child.getData("originX") as number;
        const originY = child.getData("originY") as number;
        const seed = child.getData("seed") as number;
        const mechanics = CIRCLE_LEVELS[this.currentCircleIndex]?.mechanics ?? [];
        const speedScale = enemyTuning.speedScale;

        if (kind === "flyer") {
          this.enemyVisuals.get(child as Phaser.Physics.Arcade.Sprite)?.play("move");
          body.setVelocity(
            Math.cos((time + seed) / 700) * 32 * speedScale,
            Math.sin((time + seed) / 520) * 20 * speedScale,
          );
          if (Math.abs(child.y - originY) > 48) body.setVelocityY((originY - child.y) * 1.2);
        } else if (kind === "sentry") {
          body.setVelocity(0, 0);
          const visual = this.enemyVisuals.get(child as Phaser.Physics.Arcade.Sprite);
          if (!child.getData("engaged")) {
            child.setData("engaged", true);
            child.setData(
              "nextAttackAt",
              time + enemyTuning.sentry.firstAttackDelayMs,
            );
          }
          const nextAttackAt = child.getData("nextAttackAt") as number;
          if (time >= nextAttackAt) {
            child.setData(
              "nextAttackAt",
              time + enemyTuning.sentry.intervalMs,
            );
            // The shot belongs to gameplay time, not to the optional authored
            // animation. Resetting only the visual also re-arms its one-shot.
            visual?.reset("idle");
            visual?.play("attack");
            const targetX = this.player.x;
            const targetY = this.player.y;
            this.time.delayedCall(enemyTuning.sentry.windupMs, () => {
              if (!isBodyObject(child)) return;
              if (
                !canReleaseTimedAttack({
                  actorActive: child.active,
                  defeated: Boolean(child.getData("defeated")),
                  hp: child.getData("hp") as number,
                  bodyEnabled: child.body.enable,
                  phase: this.phase,
                }) ||
                !this.isActorEngaged(
                  child.y,
                  this.tuning.enemies.engagementDistance,
                )
              ) {
                return;
              }
              this.fireHostileProjectile(
                child.x,
                child.y,
                targetX,
                targetY,
                this.elapsedMs,
                this.tuning.enemies.sentry.projectileSpeed,
              );
              visual?.play("idle");
            });
          }
        } else {
          this.enemyVisuals.get(child as Phaser.Physics.Arcade.Sprite)?.play("move");
          let speed = kind === "roller" ? 92 : kind === "charger" ? 74 : kind === "mimic" ? 52 : 38;
          if (mechanics.includes("rolling-stones") && kind === "roller") speed *= 1.35;
          if (mechanics.includes("counterweights") && kind === "charger") speed *= 1.18;
          if (kind === "charger" && Math.abs(child.x - this.player.x) < 130) speed *= 1.55;
          body.setVelocityX(direction * speed * speedScale);
          (child as Phaser.Physics.Arcade.Sprite).setFlipX(direction < 0);
          if (Math.abs(child.x - originX) > (kind === "roller" ? 96 : 56) || body.blocked.left || body.blocked.right) {
            child.setData("direction", direction * -1);
          }
          if (kind === "mimic" && this.player.body instanceof PhaserRuntime.Physics.Arcade.Body) {
            const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
            if (
              (playerBody.velocity.y < -250 || mechanics.includes("memory-platforms")) &&
              body.blocked.down &&
              Math.abs(child.x - this.player.x) < 128
            ) {
              body.setVelocityY(-300);
            }
          }
        }
      });
    }

    private isActorEngaged(actorY: number, engagementDistance: number) {
      return (
        isWithinVerticalViewport({
          actorY,
          scrollY: this.cameras.main.scrollY,
          viewportHeight: this.viewportHeight,
        }) && Math.abs(actorY - this.player.y) <= engagementDistance
      );
    }

    private updateBosses(time: number) {
      this.bosses.getChildren().forEach((child) => {
        if (!isDynamicBodyObject(child) || !child.active) return;
        const id = child.getData("id") as BossId;
        const hp = child.getData("hp") as number;
        if (hp <= 0) return;
        const bossTuning = this.tuning.bosses;
        const engaged = this.isActorEngaged(
          child.y,
          bossTuning.engagementDistance,
        );
        const active = child.getData("active") as boolean;
        if (!active && engaged) {
          child.setData("active", true);
          child.setData("engaged", true);
          child.setData("nextAttackAt", time + bossTuning.firstAttackDelayMs);
          this.activeBoss = child as Phaser.Physics.Arcade.Sprite;
          const circleIndex = CIRCLE_LEVELS.findIndex((level) => level.boss === id);
          const circleSpawn = this.circleSpawns.get(circleIndex);
          this.bossCheckpointCircleIndex = circleIndex;
          this.bossCheckpointSpawn =
            this.resolveLastStableSpawn() ?? circleSpawn?.clone() ?? null;
          this.breath = this.tuning.combat.maxBreath;
          this.emitAudio("boss-enter");
          this.bossVisuals.get(child as Phaser.Physics.Arcade.Sprite)?.play("move");
          this.emitAnnouncement(`${BOSS_NAMES[id]} custodisce il passaggio.`);
          this.emitSnapshot(true);
        }
        if (!(child.getData("active") as boolean)) return;
        if (!engaged) {
          child.setData("engaged", false);
          child.body.setVelocity(0, 0);
          child.setData(
            "nextAttackAt",
            Math.max(
              child.getData("nextAttackAt") as number,
              time + bossTuning.firstAttackDelayMs,
            ),
          );
          return;
        }
        if (!child.getData("engaged")) {
          child.setData("engaged", true);
          child.setData("nextAttackAt", time + bossTuning.firstAttackDelayMs);
        }

        const maxHp = child.getData("maxHp") as number;
        const bossSprite = child as Phaser.Physics.Arcade.Sprite;
        const healthRatio = hp / maxHp;
        const phase = healthRatio > 0.66 ? 1 : healthRatio > 0.33 ? 2 : 3;
        const previousPhase = (child.getData("phase") as number | undefined) ?? 1;
        if (phase !== previousPhase) {
          child.setData("phase", phase);
          child.setData("nextAttackAt", time + bossTuning.phaseTransitionDelayMs);
          bossSprite.setTint(phase === 2 ? 0x39f4ff : 0xff4f73);
          this.time.delayedCall(260, () => {
            if (child.active) bossSprite.clearTint();
          });
          this.emitAnnouncement(`${BOSS_NAMES[id]} — fase ${phase}.`);
          this.vfx?.playAttached("boss-telegraph", bossSprite, { scale: 1 + phase * 0.08 });
        }
        const originX = child.getData("originX") as number;
        const originY = child.getData("originY") as number;
        const travel = bossTuning.phaseTravel[phase - 1];
        child.body.setVelocityX(Math.sin(time / (700 - phase * 90)) * travel);
        child.body.setVelocityY((originY - child.y) * 1.3);
        if (Math.abs(child.x - originX) > 145) child.x = originX + Math.sign(child.x - originX) * 145;
        this.bossVisuals.get(bossSprite)?.play("move");

        const nextAttackAt = child.getData("nextAttackAt") as number;
        if (time >= nextAttackAt) {
          child.setData("nextAttackAt", time + bossTuning.telegraphMs + 100);
          bossSprite.setTint(0xffd166);
          this.bossVisuals.get(bossSprite)?.play("telegraph");
          this.vfx?.playAttached("boss-telegraph", bossSprite, { scale: 1.15 });
          this.emitAudio("boss-telegraph");
          const targetX = this.player.x;
          const targetY = this.player.y;
          this.time.delayedCall(bossTuning.telegraphMs, () => {
            if (!isBodyObject(child)) return;
            if (
              !canReleaseTimedAttack({
                actorActive: child.active,
                defeated: Boolean(child.getData("defeated")),
                hp: child.getData("hp") as number,
                  bodyEnabled: child.body.enable,
                  phase: this.phase,
                }) ||
                !this.isActorEngaged(
                  child.y,
                  this.tuning.bosses.engagementDistance,
                )
              ) {
                child.setData(
                  "nextAttackAt",
                  this.elapsedMs + this.tuning.bosses.firstAttackDelayMs,
                );
                return;
              }
            bossSprite.clearTint();
            this.bossVisuals.get(bossSprite)?.play("attack");
            child.setData(
              "nextAttackAt",
              this.elapsedMs + this.tuning.bosses.phaseCooldownMs[phase - 1],
            );
            const spread = phase === 1 ? [0] : phase === 2 ? [-34, 34] : [-52, 0, 52];
            spread.forEach((offset) => {
              this.fireHostileProjectile(
                child.x,
                child.y + 20,
                targetX + offset,
                targetY,
                this.elapsedMs,
                this.tuning.bosses.phaseProjectileSpeed[phase - 1],
              );
            });
          });
        }
      });
    }

    private fireHostileProjectile(
      x: number,
      y: number,
      targetX: number,
      targetY: number,
      time: number,
      speed: number,
    ) {
      const direction = new PhaserRuntime.Math.Vector2(targetX - x, targetY - y).normalize().scale(speed);
      const projectile = this.physics.add.sprite(x, y, "noise-projectile");
      const recipe = this.vfx?.applyProjectileVisual(projectile, "noise", 0);
      if (recipe) projectile.setDisplaySize(recipe.recommendedDisplaySize.width, recipe.recommendedDisplaySize.height);
      projectile.setDepth(10).setData({
        expiresAt: time + 3_000,
        bornAt: time,
        projectileKind: "noise",
        lastTrailAt: time,
      });
      this.setWorldHitbox(projectile, recipe?.usesAtlas ? 12 : 9, recipe?.usesAtlas ? 10 : 9);
      this.hostileProjectiles.add(projectile);
      (projectile.body as Phaser.Physics.Arcade.Body)
        .setAllowGravity(false)
        .setVelocity(direction.x, direction.y);
    }

    private setWorldHitbox(
      projectile: Phaser.Physics.Arcade.Sprite,
      worldWidth: number,
      worldHeight: number,
    ) {
      const body = projectile.body as Phaser.Physics.Arcade.Body;
      const sourceHitbox = resolveSourceHitbox(
        worldWidth,
        worldHeight,
        projectile.scaleX,
        projectile.scaleY,
      );
      body.setSize(sourceHitbox.width, sourceHitbox.height, true);
    }

    private updateProjectiles(time: number) {
      [this.playerProjectiles, this.hostileProjectiles].forEach((group) => {
        group.getChildren().forEach((child) => {
          if (!isBodyObject(child)) return;
          const expiresAt = child.getData("expiresAt") as number;
          const bornAt = (child.getData("bornAt") as number | undefined) ?? time;
          const projectileKind = child.getData("projectileKind") as "verse" | "noise" | undefined;
          if (projectileKind) {
            const recipe = this.vfx?.applyProjectileVisual(
              child as Phaser.Physics.Arcade.Sprite,
              projectileKind,
              time - bornAt,
            );
            if (recipe?.trail) {
              const lastTrailAt = (child.getData("lastTrailAt") as number | undefined) ?? bornAt;
              if (time - lastTrailAt >= 72) {
                child.setData("lastTrailAt", time);
                this.vfx?.playWorld(recipe.trail, child.x, child.y, {
                  rotation: (child as Phaser.Physics.Arcade.Sprite).rotation,
                  scale: 0.7,
                });
              }
            }
          }
          if (
            time >= expiresAt ||
            child.x < this.worldGeometry.left - 32 ||
            child.x > this.worldGeometry.right + 32 ||
            child.y < -32 ||
            child.y > WORLD_HEIGHT + 32
          ) {
            child.destroy();
          }
        });
      });
    }

    private updateCamera() {
      const desiredY = PhaserRuntime.Math.Clamp(
        this.player.y - this.viewportHeight * 0.65,
        0,
        WORLD_HEIGHT - this.viewportHeight,
      );
      this.cameras.main.scrollY = Math.min(this.cameras.main.scrollY, desiredY);
    }

    private updateProgression() {
      const nextCircleIndex = PhaserRuntime.Math.Clamp(
        Math.floor((WORLD_HEIGHT - this.player.y) / LEVEL_HEIGHT),
        0,
        CIRCLE_LEVELS.length - 1,
      );
      this.currentCircleIndex = nextCircleIndex;
      if (nextCircleIndex === 1) this.queueActAssets(1);
      if (nextCircleIndex === 4) this.queueActAssets(2);
      const level = CIRCLE_LEVELS[nextCircleIndex];
      const nextAct = clampActIndex(level.actIndex);
      if (nextAct > this.checkpointActIndex) {
        this.checkpointActIndex = nextAct;
        this.emitAudio("checkpoint");
        this.emitAnnouncement(`Checkpoint — Atto ${nextAct + 1}`);
      }
      if (nextCircleIndex !== this.announcedCircleIndex) {
        this.announcedCircleIndex = nextCircleIndex;
        this.statusText = level.title;
        this.emitAnnouncement(level.title);
      }

      if (this.player.y <= 46 && !this.hasLivingBoss("charon")) this.completeRun();
    }

    private collectPickup(pickup: BodyObject) {
      const kind = pickup.getData("kind") as PickupKind;
      const pickupX = pickup.x;
      const pickupY = pickup.y;
      if (kind === "voice") {
        this.voices += 1;
        this.strofe = Math.floor(this.voices / 3);
        if (this.voices % 3 === 0) this.shield = true;
        this.breath = restoreBreath(
          this.breath,
          this.tuning.combat.voiceBreathRestore,
          this.tuning.combat.maxBreath,
        );
      } else if (kind === "breath") {
        this.breath = restoreBreath(
          this.breath,
          46,
          this.tuning.combat.maxBreath,
        );
      } else if (kind === "rima") {
        this.rimaUntil = this.elapsedMs + this.tuning.combat.rimaDurationMs;
      } else {
        this.shield = true;
      }
      pickup.destroy();
      const pickupTint =
        kind === "voice"
          ? 0x39f4ff
          : kind === "breath"
            ? 0x76e6a6
            : kind === "rima"
              ? 0xff7fd1
              : 0xffd166;
      this.vfx?.playWorld("pickup", pickupX, pickupY, { tint: pickupTint });
      this.emitAudio("pickup");
      this.emitSnapshot(true);
    }

    private damageEnemy(enemy: BodyObject) {
      if (enemy.getData("defeated")) return;
      const hp = (enemy.getData("hp") as number) - 1;
      enemy.setData("hp", hp);
      this.vfx?.playWorld("enemy-hit", enemy.x, enemy.y - 4);
      this.emitAudio("enemy-hit");
      if (hp <= 0) {
        enemy.setData("defeated", true);
        enemy.body.enable = false;
        if (isDynamicBodyObject(enemy)) enemy.body.stop();
        this.enemyVisuals.get(enemy as Phaser.Physics.Arcade.Sprite)?.destroy();
        const destroyEnemy = () => {
          if (enemy.active) enemy.destroy();
        };
        this.vfx?.playWorld("enemy-dissolve", enemy.x, enemy.y, {
          scale: 1.05,
          onComplete: destroyEnemy,
        });
        // Pool reclamation may cancel a visual callback, so gameplay cleanup
        // always owns an independent, idempotent timer.
        this.time.delayedCall(430, destroyEnemy);
        this.emitAudio("enemy-break");
      } else if ("setTintFill" in enemy) {
        (enemy as Phaser.Physics.Arcade.Sprite).setTintFill();
        this.time.delayedCall(70, () => {
          if (enemy.active && "clearTint" in enemy) (enemy as Phaser.Physics.Arcade.Sprite).clearTint();
        });
      }
    }

    private damageBoss(boss: BodyObject) {
      if (boss.getData("defeated")) return;
      const hp = Math.max(0, (boss.getData("hp") as number) - 1);
      boss.setData("hp", hp);
      this.emitAudio("boss-hit");
      this.bossVisuals.get(boss as Phaser.Physics.Arcade.Sprite)?.play("hit");
      this.vfx?.playWorld("enemy-hit", boss.x, boss.y - 8, { scale: 1.24 });
      if (!bridge.reducedMotion) this.cameras.main.shake(55, 0.0025);
      if (hp > 0) return;

      const id = boss.getData("id") as BossId;
      boss.setData("defeated", true);
      boss.body.enable = false;
      if (isDynamicBodyObject(boss)) boss.body.stop();
      const gate = this.bossGates.get(id);
      if (gate) {
        this.staticPlatforms.remove(gate);
        gate.destroy();
        this.bossGates.delete(id);
      }
      if (this.activeBoss === boss) this.activeBoss = null;
      this.clearProjectiles();
      const bossVisual = this.bossVisuals.get(boss as Phaser.Physics.Arcade.Sprite);
      bossVisual?.play("defeat");
      const destroyBoss = () => {
        if (boss.active) boss.destroy();
      };
      this.vfx?.playWorld("boss-burst", boss.x, boss.y, {
        scale: 1.45,
        onComplete: destroyBoss,
      });
      this.time.delayedCall(700, destroyBoss);
      this.emitAnnouncement(`${BOSS_NAMES[id]} si dissolve in lettere.`);
      this.emitAudio("boss-break");
      this.emitSnapshot(true);
    }

    private hasLivingBoss(id: BossId) {
      return this.bosses.getChildren().some(
        (child) => isBodyObject(child) && child.active && child.getData("id") === id && (child.getData("hp") as number) > 0,
      );
    }

    private takeDamage(reason: string, isFall = false) {
      if (this.phase !== "playing" || this.elapsedMs < this.invulnerableUntil) return;
      if (this.shield) {
        this.shield = false;
        this.invulnerableUntil =
          this.elapsedMs + this.tuning.player.invulnerableMs;
        this.vfx?.playAttached("shield-break", this.player, { scale: 1.1 });
        this.emitAudio("shield-break");
        if (isFall) this.respawnAfterDamage();
        return;
      }

      this.lives -= 1;
      this.phase = "dying";
      this.hitUntil = this.elapsedMs + 800;
      this.statusText = `${reason} — ${Math.max(0, this.lives)} vite`;
      this.emitAudio("hit");
      this.playerVisual?.play("hit", {
        onComplete: () => this.playerVisual?.play("defeat"),
      });
      this.vfx?.playAttached("player-hit", this.player);
      const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
      playerBody.stop();
      playerBody.enable = false;
      this.player.setTint(0xff4f73).setAlpha(0.55);
      this.clearThreatsNearRespawn();
      this.emitSnapshot(true);

      this.time.delayedCall(820, () => {
        if (bridge.destroyed || this.phase !== "dying") return;
        if (this.lives <= 0) {
          this.phase = "game-over";
          this.statusText = "La voce si spezza";
          this.physics.pause();
          this.emitAudio("game-over");
          this.emitAnnouncement("La voce si spezza. Continua dall'Atto o ricomincia la Cantica.");
          this.emitSnapshot(true);
          return;
        }
        playerBody.enable = true;
        this.respawnAfterDamage();
        this.phase = "playing";
        this.statusText = CIRCLE_LEVELS[this.currentCircleIndex].title;
        this.emitSnapshot(true);
      });
    }

    private getActCheckpointSpawn() {
      return (
        this.checkpointSpawns.get(this.checkpointActIndex) ??
        this.checkpointSpawns.get(0) ??
        new PhaserRuntime.Math.Vector2(GAME_WIDTH / 2, WORLD_HEIGHT - 80)
      );
    }

    private getDamageRespawnSpawn() {
      if (bridge.assist) {
        const stableSpawn = this.resolveLastStableSpawn();
        if (stableSpawn) return stableSpawn;
      }
      if (
        this.bossCheckpointSpawn &&
        this.bossCheckpointCircleIndex === this.currentCircleIndex
      ) {
        return this.bossCheckpointSpawn;
      }
      return this.circleSpawns.get(this.currentCircleIndex) ?? this.getActCheckpointSpawn();
    }

    private respawnAtActCheckpoint() {
      this.currentCircleIndex = this.checkpointActIndex * 3;
      this.placePlayerAtSpawn(this.getActCheckpointSpawn());
    }

    private respawnAfterDamage() {
      this.placePlayerAtSpawn(this.getDamageRespawnSpawn());
    }

    private placePlayerAtSpawn(spawn: Phaser.Math.Vector2) {
      this.clearProjectiles();
      const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
      playerBody.enable = true;
      const spawnX = PhaserRuntime.Math.Clamp(
        spawn.x,
        this.worldGeometry.left + 24,
        this.worldGeometry.right - 24,
      );
      this.player.setPosition(spawnX, spawn.y).setAlpha(1).clearTint();
      this.landedUntil = -Infinity;
      this.playerVisual?.reset("respawn");
      this.vfx?.playAttached("player-respawn", this.player, { offsetY: 4 });
      this.emitAudio("respawn");
      playerBody.reset(spawnX, spawn.y);
      playerBody.setVelocity(0, 0);
      this.jumpWindowState = { ...INITIAL_JUMP_WINDOW_STATE, jumpCut: true };
      this.invulnerableUntil =
        this.elapsedMs + this.tuning.player.invulnerableMs;
      this.breath = Math.max(this.breath, this.tuning.respawn.minimumBreath);
      bridge.input.moveX = 0;
      bridge.input.jumpPressed = false;
      bridge.input.jumpHeld = false;
      bridge.input.firePressed = false;
      bridge.input.fireHeld = false;
      const cameraY = PhaserRuntime.Math.Clamp(
        spawn.y - this.viewportHeight * 0.65,
        0,
        WORLD_HEIGHT - this.viewportHeight,
      );
      this.cameras.main.scrollY = cameraY;
    }

    private clearProjectiles() {
      this.playerProjectiles.clear(true, true);
      this.hostileProjectiles.clear(true, true);
    }

    private clearThreatsNearRespawn() {
      this.clearProjectiles();
      const spawn = this.getDamageRespawnSpawn();
      if (!spawn) return;
      this.enemies.getChildren().forEach((child) => {
        if (!isBodyObject(child)) return;
        if (
          PhaserRuntime.Math.Distance.Between(
            child.x,
            child.y,
            spawn.x,
            spawn.y,
          ) < this.tuning.respawn.threatClearRadius
        ) {
          child.destroy();
        }
      });
    }

    private completeRun() {
      if (this.phase === "complete") return;
      this.phase = "complete";
      this.statusText = "E quindi uscimmo a riveder le stelle";
      this.physics.pause();
      this.playerVisual?.pause();
      this.enemyVisuals.forEach((visual) => visual.pause());
      this.bossVisuals.forEach((visual) => visual.pause());
      this.vfx?.playWorld("boss-burst", this.player.x, this.player.y - 36, {
        scale: 1.65,
      });
      let isRecord = false;
      if (this.recordEligible && (this.bestMs === null || this.elapsedMs < this.bestMs)) {
        this.bestMs = Math.round(this.elapsedMs);
        writeBestTime(this.assistedRun, this.bestMs);
        isRecord = true;
        bridge.onEvent({ type: "record", elapsedMs: this.bestMs, assist: this.assistedRun });
      }
      this.emitAudio("complete");
      this.emitAnnouncement(isRecord ? "Nuovo record. Le stelle ricordano il tuo tempo." : this.statusText);
      this.emitSnapshot(true);
    }

    private emitAudio(cue: GameAudioCue) {
      bridge.onEvent({ type: "audio", cue });
    }

    private emitAnnouncement(message: string) {
      bridge.onEvent({ type: "announcement", message });
    }

    private buildSnapshot(): GameSnapshot {
      const level = CIRCLE_LEVELS[this.currentCircleIndex] ?? CIRCLE_LEVELS[0];
      const quota = Math.round(
        -900 + PhaserRuntime.Math.Clamp((WORLD_HEIGHT - this.player?.y) / WORLD_HEIGHT, 0, 1) * 900,
      );
      let bossSnapshot: BossSnapshot | null = null;
      if (this.activeBoss?.active) {
        const hp = this.activeBoss.getData("hp") as number;
        if (hp > 0) {
          const id = this.activeBoss.getData("id") as BossId;
          bossSnapshot = {
            id,
            name: BOSS_NAMES[id],
            health: hp,
            maxHealth: this.activeBoss.getData("maxHp") as number,
          };
        }
      }
      return {
        phase: this.phase,
        elapsedMs: Math.round(this.elapsedMs),
        recordEligible: this.recordEligible,
        lives: this.lives,
        breath: Math.round(this.breath),
        voices: this.voices,
        strofe: this.strofe,
        quota,
        circleId: level.id,
        actIndex: clampActIndex(level.actIndex),
        checkpointActIndex: this.checkpointActIndex,
        shield: this.shield,
        rimaMs: Math.max(0, Math.round(this.rimaUntil - this.elapsedMs)),
        boss: bossSnapshot,
        bestMs: this.bestMs,
        assist: bridge.assist,
        statusText: this.statusText,
      };
    }

    private emitSnapshot(force = false) {
      if (!force && this.elapsedMs - this.lastSnapshotAt < SNAPSHOT_INTERVAL_MS) return;
      this.lastSnapshotAt = this.elapsedMs;
      bridge.onSnapshot(this.buildSnapshot());
    }
  }

  return new AscentScene();
}
