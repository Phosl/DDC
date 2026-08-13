import type Phaser from "phaser";

import {
  ASSIST_PLAYER,
  COMBAT,
  GAME_HEIGHT,
  GAME_WIDTH,
  PLAYER,
  RECORD_STORAGE_KEY,
  SNAPSHOT_INTERVAL_MS,
  TILE_SIZE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./config";
import {
  CIRCLE_LEVELS,
  LEVEL_HEIGHT,
  assertValidCircleLevels,
  getLevelWorldOffsetY,
  type CircleLevelDefinition,
} from "./level-data";
import type { AscentSceneHandle, RuntimeBridge } from "./internal";
import { shouldCollideOneWay as shouldCollideOneWayRule } from "./rules";
import type {
  BossSnapshot,
  GameAudioCue,
  GamePhase,
  GameSnapshot,
} from "./types";

type PhaserNamespace = typeof Phaser;
type BodyGameObject = Phaser.GameObjects.Rectangle | Phaser.Physics.Arcade.Sprite;
type BodyObject = BodyGameObject & {
  body: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody;
};
type DynamicBodyObject = BodyGameObject & {
  body: Phaser.Physics.Arcade.Body;
};
type BossId = BossSnapshot["id"];
type EnemyKind =
  | "walker"
  | "charger"
  | "sentry"
  | "flyer"
  | "roller"
  | "mimic";
type PickupKind = "voice" | "breath" | "rima" | "light";

const BOSS_NAMES: Record<BossId, string> = {
  minotaur: "Minotauro",
  pluto: "Pluto",
  charon: "Caronte",
};

const BOSS_TEXTURES: Record<BossId, string> = {
  minotaur: "boss-minotaur",
  pluto: "boss-pluto",
  charon: "boss-charon",
};

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
  player: "/game/v2/sprites/davide-atlas-v2.png",
  enemies: "/game/v2/enemies/enemies-atlas.png",
  platforms: "/game/v2/tiles/platforms.png",
  minotaur: "/game/v2/enemies/minotauro.png",
  pluto: "/game/v2/enemies/pluto.png",
  charon: "/game/v2/enemies/caronte.png",
} as const;

function isBodyObject(value: unknown): value is BodyObject {
  return Boolean(
    value &&
      typeof value === "object" &&
      "body" in value &&
      "getData" in value,
  );
}

function isDynamicBodyObject(value: unknown): value is DynamicBodyObject {
  return isBodyObject(value) && "velocity" in value.body;
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
    private breath: number = COMBAT.maxBreath;
    private voices = 0;
    private strofe = 0;
    private recordEligible = true;
    private assistedRun = bridge.assist;
    private checkpointActIndex: 0 | 1 | 2 = 0;
    private shield = false;
    private rimaUntil = 0;
    private invulnerableUntil = 0;
    private lastShotAt = -Infinity;
    private lastSnapshotAt = -Infinity;
    private lastGroundedAt = -Infinity;
    private jumpBufferedAt = -Infinity;
    private jumpCut = true;
    private wasGrounded = false;
    private landedUntil = -Infinity;
    private hitUntil = -Infinity;
    private currentCircleIndex = 0;
    private announcedCircleIndex = -1;
    private statusText = "Preparati alla salita";
    private bestMs: number | null = null;
    private activeBoss: Phaser.Physics.Arcade.Sprite | null = null;
    private phaseBeforePause: GamePhase = "playing";
    private player!: Phaser.Physics.Arcade.Sprite;
    private authoredPlayer = false;
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
    private loadedActs = new Set<number>();
    private loadingActs = new Set<number>();
    private backgroundLevelsDrawn = new Set<string>();
    private lastMovingPlatform: Phaser.GameObjects.GameObject | null = null;
    private assetLoadFailed = false;

    constructor() {
      super({ key: "cantica-zero-ascent" });
    }

    init() {
      this.phase = "ready";
      this.elapsedMs = 0;
      this.lives = 3;
      this.breath = COMBAT.maxBreath;
      this.voices = 0;
      this.strofe = 0;
      this.recordEligible = true;
      this.assistedRun = bridge.assist;
      this.checkpointActIndex = 0;
      this.shield = false;
      this.rimaUntil = 0;
      this.invulnerableUntil = 0;
      this.lastShotAt = -Infinity;
      this.lastSnapshotAt = -Infinity;
      this.lastGroundedAt = -Infinity;
      this.jumpBufferedAt = -Infinity;
      this.jumpCut = true;
      this.wasGrounded = false;
      this.landedUntil = -Infinity;
      this.hitUntil = -Infinity;
      this.currentCircleIndex = 0;
      this.announcedCircleIndex = -1;
      this.statusText = "Preparati alla salita";
      this.bestMs = readBestTime(this.assistedRun);
      this.activeBoss = null;
      this.phaseBeforePause = "playing";
      this.bossGates.clear();
      this.checkpointSpawns.clear();
      this.loadedActs.clear();
      this.loadingActs.clear();
      this.backgroundLevelsDrawn.clear();
      this.lastMovingPlatform = null;
      this.assetLoadFailed = false;
    }

    preload() {
      this.load.on("loaderror", () => {
        this.assetLoadFailed = true;
      });

      this.load.spritesheet("davide-v2", ASSET_PATHS.player, {
        frameWidth: 256,
        frameHeight: 256,
      });
      this.load.spritesheet("rumore-v2", ASSET_PATHS.enemies, {
        frameWidth: 418,
        frameHeight: 418,
      });
      this.load.spritesheet("platform-v2", ASSET_PATHS.platforms, {
        frameWidth: 221,
        frameHeight: 295,
      });
      this.load.spritesheet(BOSS_TEXTURES.minotaur, ASSET_PATHS.minotaur, {
        frameWidth: 355,
        frameHeight: 738,
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
      this.createPlayerAnimations();
      this.createGroups();
      this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      this.cameras.main.setBackgroundColor(ACT_PALETTES[0].sky);
      this.cameras.main.roundPixels = true;

      CIRCLE_LEVELS.forEach((level, index) => this.buildLevel(level, index));
      this.loadedActs.add(0);
      if (this.textures.exists(BOSS_TEXTURES.pluto)) this.loadedActs.add(1);
      if (this.textures.exists(BOSS_TEXTURES.charon)) this.loadedActs.add(2);

      const initialSpawn =
        this.checkpointSpawns.get(0) ??
        new PhaserRuntime.Math.Vector2(GAME_WIDTH / 2, WORLD_HEIGHT - 80);
      this.createPlayer(initialSpawn.x, initialSpawn.y);
      this.createCollisions();

      this.cameras.main.scrollY = Math.max(0, WORLD_HEIGHT - GAME_HEIGHT);
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

      const safeDelta = Math.min(delta, 100);
      this.elapsedMs += safeDelta;
      const gameTime = this.elapsedMs;
      this.updatePlayer(gameTime, safeDelta);
      this.updateMovingPlatforms();
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
      this.emitSnapshot(true);
    }

    resumeGame() {
      if (this.phase === "game-over" || this.phase === "complete") return;
      this.time.paused = false;
      this.phase = this.phaseBeforePause === "dying" ? "dying" : "playing";
      this.statusText = CIRCLE_LEVELS[this.currentCircleIndex]?.title ?? "Sali";
      bridge.desiredRunning = true;
      this.physics.resume();
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
      this.respawnAtCheckpoint();
      this.emitAnnouncement("Continui dall'inizio dell'Atto. Record disattivato.");
      this.emitSnapshot(true);
    }

    setAssist(enabled: boolean) {
      bridge.assist = enabled;
      this.assistedRun = this.phase === "ready" ? enabled : this.assistedRun || enabled;
      this.bestMs = readBestTime(this.assistedRun);
      this.emitSnapshot(true);
    }

    setReducedMotion(enabled: boolean) {
      bridge.reducedMotion = enabled;
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

    private queueActAssets(actIndex: 1 | 2) {
      if (this.loadedActs.has(actIndex) || this.loadingActs.has(actIndex)) return;
      const bossId: BossId = actIndex === 1 ? "pluto" : "charon";
      const theme = actIndex === 1 ? "dite" : "stelle";
      if (!this.textures.exists(BOSS_TEXTURES[bossId])) {
        this.load.spritesheet(BOSS_TEXTURES[bossId], ASSET_PATHS[bossId], {
          frameWidth: bossId === "pluto" ? 362 : 295,
          frameHeight: bossId === "pluto" ? 724 : 887,
        });
      }
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
      this.createPlayerAnimations();
      CIRCLE_LEVELS.filter((level) => level.actIndex === actIndex).forEach((level) => {
        this.createLevelBackground(level, getLevelWorldOffsetY(level.orderFromBottom));
      });
      const boss = this.bosses.getChildren().find(
        (child) => isDynamicBodyObject(child) && child.getData("id") === bossId,
      );
      if (!boss || !isDynamicBodyObject(boss) || !this.textures.exists(BOSS_TEXTURES[bossId])) return;
      const sprite = boss as Phaser.Physics.Arcade.Sprite;
      sprite.setTexture(BOSS_TEXTURES[bossId], 0).setDisplaySize(118, 88);
      const bossBody = sprite.body as Phaser.Physics.Arcade.Body;
      bossBody.setSize(
        Math.round((sprite.frame.realWidth * 78) / sprite.displayWidth),
        Math.round((sprite.frame.realHeight * 58) / sprite.displayHeight),
        true,
      );
      if (this.anims.exists(`boss-${bossId}-move`)) sprite.anims.play(`boss-${bossId}-move`);
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
        maxSize: COMBAT.maxProjectiles,
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

    private createPlayerAnimations() {
      if (!this.textures.exists("davide-v2")) return;
      const definitions = [
        ["davide-idle", 0, 1, 4, -1],
        ["davide-run", 2, 5, 12, -1],
        ["davide-jump", 6, 9, 12, 0],
        ["davide-fall", 10, 10, 8, 0],
        ["davide-land", 11, 11, 18, 0],
        ["davide-fire-up-ground", 12, 13, 15, 0],
        ["davide-fire-up-air", 14, 15, 15, 0],
        ["davide-fire-diagonal", 16, 17, 15, 0],
        ["davide-hit", 18, 19, 16, 0],
        ["davide-defeat", 20, 21, 9, 0],
        ["davide-respawn", 22, 23, 10, 0],
      ] as const;

      definitions.forEach(([key, start, end, frameRate, repeat]) => {
        if (this.anims.exists(key)) return;
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers("davide-v2", { start, end }),
          frameRate,
          repeat,
        });
      });

      (["minotaur", "pluto", "charon"] as const).forEach((id) => {
        const texture = BOSS_TEXTURES[id];
        if (!this.textures.exists(texture) || this.anims.exists(`boss-${id}-move`)) {
          return;
        }
        this.anims.create({
          key: `boss-${id}-move`,
          frames: this.anims.generateFrameNumbers(texture, { start: 0, end: 5 }),
          frameRate: bridge.reducedMotion ? 3 : 7,
          repeat: -1,
        });
      });
    }

    private buildLevel(level: CircleLevelDefinition, index: number) {
      const offsetY = getLevelWorldOffsetY(level.orderFromBottom);
      const palette = ACT_PALETTES[level.actIndex];
      this.createLevelBackground(level, offsetY);
      this.add
        .rectangle(GAME_WIDTH / 2, offsetY + LEVEL_HEIGHT / 2, GAME_WIDTH, LEVEL_HEIGHT, palette.sky, 0.2)
        .setDepth(-18);
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
            this.createPlatform(
              x + ((run - 1) * TILE_SIZE) / 2,
              y,
              run * TILE_SIZE,
              level.actIndex,
              symbol === "#" ? "static" : symbol === "-" ? "one-way" : "crumble",
              level,
              row,
            );
            column += run - 1;
            continue;
          }

          if (symbol === "H" || symbol === "V") {
            this.createMovingPlatform(x, y, level.actIndex, symbol === "H" ? "x" : "y");
          } else if (symbol === "S") {
            if (level.checkpoint) {
              this.checkpointSpawns.set(level.actIndex, new PhaserRuntime.Math.Vector2(x, y - 30));
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
          GAME_WIDTH / 2,
          offsetY + LEVEL_HEIGHT / 2,
          GAME_WIDTH,
          LEVEL_HEIGHT,
          key,
        );
        tile.setTileScale(0.5);
        tile.setAlpha([0.48, 0.44, 0.32][layerIndex]);
        tile.setDepth(-30 + layerIndex * 3);
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
      platform.setData("kind", kind);
      if (authoredVisual) {
        const frame = actIndex * 8 + (kind === "crumble" ? 2 : kind === "one-way" ? 1 : 0);
        const visual = this.add
          .image(x, y - (kind === "one-way" ? 1 : 3), "platform-v2", frame)
          .setDisplaySize(width, Math.max(18, height + 12))
          .setDepth(2);
        platform.setData("visual", visual);
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
      const palette = ACT_PALETTES[actIndex];
      const platform = this.add.rectangle(x, y, 64, 12, palette.accent, 0.92);
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
        direction: 1,
        range: axis === "x" ? 72 : 58,
        lastX: x,
        lastY: y,
      });
      if (authoredVisual) {
        const visual = this.add
          .image(x, y - 2, "platform-v2", actIndex * 8 + (axis === "x" ? 3 : 4))
          .setDisplaySize(72, 24)
          .setDepth(2);
        platform.setData("visual", visual);
      }
      if (axis === "x") body.setVelocityX(48);
      else body.setVelocityY(-38);
      this.movingPlatforms.add(platform);
    }

    private createEnemy(x: number, y: number, kind: EnemyKind, actIndex: 0 | 1 | 2) {
      const authored = this.textures.exists("rumore-v2");
      const texture = authored ? "rumore-v2" : kind === "flyer" ? "flyer" : "enemy";
      const kindOrder: readonly EnemyKind[] = ["walker", "charger", "sentry", "roller", "mimic", "flyer"];
      const kindIndex = Math.max(0, kindOrder.indexOf(kind));
      const enemy = this.physics.add.sprite(x, y, texture, authored ? actIndex * 3 + (kindIndex % 3) : 0);
      if (authored) enemy.setDisplaySize(kind === "flyer" ? 43 : 38, kind === "flyer" ? 39 : 42);
      enemy.setDepth(5).setData({
        kind,
        hp: kind === "roller" || kind === "charger" ? 3 : kind === "sentry" ? 2 : 1,
        originX: x,
        originY: y,
        direction: x < GAME_WIDTH / 2 ? 1 : -1,
        nextAttackAt: 0,
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
      body.setMaxVelocity(120, PLAYER.maxFallVelocity);
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
      const texture = this.textures.exists(BOSS_TEXTURES[id]) ? BOSS_TEXTURES[id] : "boss-fallback";
      const boss = this.physics.add.sprite(x, y, texture, 0);
      const authored = texture !== "boss-fallback";
      if (authored) boss.setDisplaySize(118, 88);
      boss.setDepth(8).setData({
        id,
        hp: 18,
        maxHp: 18,
        originX: x,
        originY: y,
        nextAttackAt: 0,
        active: false,
        actIndex,
      });
      const body = boss.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(false).setImmovable(true);
      body.setSize(authored ? Math.floor(boss.frame.realWidth * 0.55) : 78, authored ? Math.floor(boss.frame.realHeight * 0.62) : 58);
      if (authored && this.anims.exists(`boss-${id}-move`)) boss.anims.play(`boss-${id}-move`);
      this.bosses.add(boss);

      const palette = ACT_PALETTES[actIndex];
      const gate = this.add.rectangle(GAME_WIDTH / 2, levelOffsetY + 32, GAME_WIDTH, 14, palette.accent, 0.8);
      gate.setDepth(4).setData("bossId", id);
      this.physics.add.existing(gate, true);
      this.staticPlatforms.add(gate);
      this.bossGates.set(id, gate);
    }

    private createPlayer(x: number, y: number) {
      this.authoredPlayer = this.textures.exists("davide-v2");
      this.player = this.physics.add.sprite(x, y, this.authoredPlayer ? "davide-v2" : "player-fallback", 0);
      this.player.setDepth(12).setCollideWorldBounds(true);
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      if (this.authoredPlayer) {
        this.player.setScale(0.25).setOrigin(0.5, 0.90625);
        body.setSize(88, 128, true);
        body.setOffset(84, 104);
      } else {
        this.player.setOrigin(0.5, 0.90625);
        body.setSize(22, 32, true);
        body.setOffset(13, 26);
      }
      body.setMaxVelocity(PLAYER.speed, PLAYER.maxFallVelocity);
      if (this.authoredPlayer && this.anims.exists("davide-idle")) {
        this.player.anims.play("davide-idle");
      }
    }

    private createCollisions() {
      this.physics.add.collider(this.player, this.staticPlatforms);
      this.physics.add.collider(this.player, this.movingPlatforms, (_player, platform) => {
        if (isBodyObject(platform)) this.lastMovingPlatform = platform;
      });
      this.physics.add.collider(
        this.player,
        this.oneWayPlatforms,
        undefined,
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
        if (isBodyObject(projectile)) projectile.destroy();
        this.takeDamage("Frammento ostile");
      });
      this.physics.add.overlap(this.player, this.pickups, (_player, pickup) => {
        if (isBodyObject(pickup)) this.collectPickup(pickup);
      });
      this.physics.add.overlap(this.playerProjectiles, this.enemies, (projectile, enemy) => {
        if (isBodyObject(projectile)) projectile.destroy();
        if (isBodyObject(enemy)) this.damageEnemy(enemy);
      });
      this.physics.add.overlap(this.playerProjectiles, this.bosses, (projectile, boss) => {
        if (isBodyObject(projectile)) projectile.destroy();
        if (isBodyObject(boss)) this.damageBoss(boss);
      });
    }

    private shouldCollideOneWay(
      moving: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile,
      platform: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile,
    ) {
      if (!isDynamicBodyObject(moving) || !isBodyObject(platform)) return false;
      const body = moving.body;
      const platformVelocityY =
        platform.body instanceof PhaserRuntime.Physics.Arcade.Body
          ? platform.body.velocity.y
          : 0;
      return shouldCollideOneWayRule({
        actorBottom: body.bottom,
        actorVelocityY: body.velocity.y,
        platformTop: platform.body.top,
        platformVelocityY,
      });
    }

    private armCrumblePlatform(platform: BodyObject) {
      if (platform.getData("armed")) return;
      platform.setData("armed", true);
      this.time.delayedCall(260, () => {
        if (!platform.active) return;
        platform.setVisible(false);
        const visual = platform.getData("visual") as Phaser.GameObjects.Image | undefined;
        visual?.setVisible(false);
        platform.body.enable = false;
        this.time.delayedCall(2_000, () => {
          if (!platform.active) return;
          platform.setVisible(true);
          visual?.setVisible(true);
          platform.body.enable = true;
          platform.setData("armed", false);
        });
      });
    }

    private updateMovingPlatforms() {
      this.movingPlatforms.getChildren().forEach((child) => {
        if (!isDynamicBodyObject(child)) return;
        const axis = child.getData("axis") as "x" | "y";
        const origin = axis === "x" ? (child.getData("originX") as number) : (child.getData("originY") as number);
        const coordinate = axis === "x" ? child.x : child.y;
        const range = child.getData("range") as number;
        const body = child.body;
        if (Math.abs(coordinate - origin) >= range) {
          const direction = coordinate > origin ? -1 : 1;
          child.setData("direction", direction);
          if (axis === "x") body.setVelocityX(48 * direction);
          else body.setVelocityY(38 * direction);
        }
        child.setData("lastX", child.x);
        child.setData("lastY", child.y);
        const visual = child.getData("visual") as Phaser.GameObjects.Image | undefined;
        if (visual?.active) visual.setPosition(child.x, child.y - 2);
      });
    }

    private updatePlayer(time: number, delta: number) {
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      const tuning = bridge.assist ? ASSIST_PLAYER : PLAYER;
      body.setMaxVelocity(tuning.speed, PLAYER.maxFallVelocity);
      body.setGravityY(bridge.assist ? ASSIST_PLAYER.gravity - PLAYER.gravity : 0);
      const mechanics = CIRCLE_LEVELS[this.currentCircleIndex]?.mechanics ?? [];
      const stickyGround = mechanics.includes("sticky") && (body.blocked.down || body.touching.down);
      const targetSpeed = bridge.input.moveX * tuning.speed * (stickyGround ? 0.66 : 1);
      if (mechanics.includes("ice") && (body.blocked.down || body.touching.down)) {
        body.setVelocityX(PhaserRuntime.Math.Linear(body.velocity.x, targetSpeed, 0.075));
      } else {
        body.setVelocityX(targetSpeed);
      }
      if (mechanics.includes("wind") && !body.blocked.down) {
        body.setVelocityX(body.velocity.x + Math.sin(time / 410) * (bridge.assist ? 12 : 24));
      }
      if (mechanics.includes("knockback") && !body.blocked.down) {
        body.setVelocityX(body.velocity.x + Math.sin(time / 260) * (bridge.assist ? 5 : 10));
      }
      if (mechanics.includes("rain") && !body.blocked.down) {
        body.setVelocityY(Math.min(PLAYER.maxFallVelocity, body.velocity.y + delta * (bridge.assist ? 0.018 : 0.034)));
      }
      if (bridge.input.moveX !== 0) this.player.setFlipX(bridge.input.moveX < 0);

      const grounded = body.blocked.down || body.touching.down;
      if (grounded) this.lastGroundedAt = time;
      if (grounded && !this.wasGrounded && body.velocity.y >= 0) {
        this.landedUntil = time + 150;
        this.emitAudio("land");
      }
      this.wasGrounded = grounded;

      if (bridge.input.jumpPressed) {
        this.jumpBufferedAt = time;
        bridge.input.jumpPressed = false;
      }
      const canUseCoyote = time - this.lastGroundedAt <= tuning.coyoteMs;
      const hasBufferedJump = time - this.jumpBufferedAt <= tuning.jumpBufferMs;
      if (hasBufferedJump && canUseCoyote) {
        body.setVelocityY(tuning.jumpVelocity);
        this.jumpBufferedAt = -Infinity;
        this.lastGroundedAt = -Infinity;
        this.jumpCut = false;
        this.emitAudio("jump");
      }
      if (!bridge.input.jumpHeld && !this.jumpCut && body.velocity.y < 0) {
        body.setVelocityY(body.velocity.y * 0.5);
        this.jumpCut = true;
      }

      if (bridge.input.firePressed || bridge.input.fireHeld) this.tryFire(time);
      bridge.input.firePressed = false;
      if (time - this.lastShotAt > COMBAT.rechargeDelayMs) {
        this.breath = Math.min(
          COMBAT.maxBreath,
          this.breath + (COMBAT.rechargePerSecond * delta) / 1_000,
        );
      }

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
      if (this.player.y > this.cameras.main.scrollY + GAME_HEIGHT + 68) {
        this.takeDamage("Caduta", true);
      }
    }

    private updatePlayerAnimation(time: number, grounded: boolean) {
      if (!this.authoredPlayer) return;
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      const firing = time - this.lastShotAt < 150;
      let key = "davide-idle";
      if (this.phase === "dying" && time + 280 >= this.hitUntil) key = "davide-defeat";
      else if (time < this.hitUntil) key = "davide-hit";
      else if (time < this.landedUntil) key = "davide-land";
      else if (firing) {
        key = grounded
          ? Math.abs(body.velocity.x) > 24
            ? "davide-fire-diagonal"
            : "davide-fire-up-ground"
          : "davide-fire-up-air";
      }
      else if (!grounded) key = body.velocity.y < 0 ? "davide-jump" : "davide-fall";
      else if (Math.abs(body.velocity.x) > 8) key = "davide-run";
      if (this.anims.exists(key)) this.player.anims.play(key, true);
    }

    private tryFire(time: number) {
      if (time - this.lastShotAt < COMBAT.fireIntervalMs || this.breath < COMBAT.shotCost) return;
      if (this.playerProjectiles.countActive(true) >= COMBAT.maxProjectiles) return;
      this.lastShotAt = time;
      this.breath -= COMBAT.shotCost;
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      const grounded = body.blocked.down || body.touching.down;
      const diagonal = grounded && Math.abs(body.velocity.x) > 24;
      const direction = body.velocity.x < 0 ? -1 : 1;
      const baseAngle = diagonal ? -90 + 35 * direction : -90;
      const angles = time < this.rimaUntil ? [baseAngle - 10, baseAngle, baseAngle + 10] : [baseAngle];
      angles.forEach((angle) => {
        const radians = PhaserRuntime.Math.DegToRad(angle);
        const projectile = this.physics.add.sprite(this.player.x, this.player.y - 30, "verse-projectile");
        projectile.setDepth(11).setRotation(radians + Math.PI / 2).setData("expiresAt", time + COMBAT.projectileLifetimeMs);
        const projectileBody = projectile.body as Phaser.Physics.Arcade.Body;
        projectileBody.setAllowGravity(false).setVelocity(
          Math.cos(radians) * COMBAT.projectileSpeed,
          Math.sin(radians) * COMBAT.projectileSpeed,
        );
        this.playerProjectiles.add(projectile);
      });
      this.emitAudio("verse");
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
        const distanceY = Math.abs(child.y - this.player.y);
        if (distanceY > GAME_HEIGHT * 0.85) {
          body.setVelocityX(0);
          return;
        }
        const kind = child.getData("kind") as EnemyKind;
        const direction = child.getData("direction") as number;
        const originX = child.getData("originX") as number;
        const originY = child.getData("originY") as number;
        const seed = child.getData("seed") as number;
        const mechanics = CIRCLE_LEVELS[this.currentCircleIndex]?.mechanics ?? [];
        const speedScale = bridge.assist ? 0.72 : 1;

        if (kind === "flyer") {
          body.setVelocity(
            Math.cos((time + seed) / 700) * 32 * speedScale,
            Math.sin((time + seed) / 520) * 20 * speedScale,
          );
          if (Math.abs(child.y - originY) > 48) body.setVelocityY((originY - child.y) * 1.2);
        } else if (kind === "sentry") {
          body.setVelocity(0, 0);
          const nextAttackAt = child.getData("nextAttackAt") as number;
          if (time >= nextAttackAt && Math.abs(child.y - this.player.y) < 460) {
            child.setData("nextAttackAt", time + (bridge.assist ? 1_700 : 1_250));
            this.fireHostileProjectile(child.x, child.y, this.player.x, this.player.y, time, 145);
          }
        } else {
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

    private updateBosses(time: number) {
      this.bosses.getChildren().forEach((child) => {
        if (!isDynamicBodyObject(child) || !child.active) return;
        const id = child.getData("id") as BossId;
        const hp = child.getData("hp") as number;
        if (hp <= 0) return;
        const active = child.getData("active") as boolean;
        if (!active && Math.abs(child.y - this.player.y) < 480) {
          child.setData("active", true);
          this.activeBoss = child as Phaser.Physics.Arcade.Sprite;
          this.emitAudio("boss-enter");
          this.emitAnnouncement(`${BOSS_NAMES[id]} custodisce il passaggio.`);
        }
        if (!(child.getData("active") as boolean)) return;

        const maxHp = child.getData("maxHp") as number;
        const bossSprite = child as Phaser.Physics.Arcade.Sprite;
        const healthRatio = hp / maxHp;
        const phase = healthRatio > 0.66 ? 1 : healthRatio > 0.33 ? 2 : 3;
        const previousPhase = (child.getData("phase") as number | undefined) ?? 1;
        if (phase !== previousPhase) {
          child.setData("phase", phase);
          child.setData("nextAttackAt", time + 620);
          bossSprite.setTint(phase === 2 ? 0x39f4ff : 0xff4f73);
          this.time.delayedCall(260, () => {
            if (child.active) bossSprite.clearTint();
          });
          this.emitAnnouncement(`${BOSS_NAMES[id]} — fase ${phase}.`);
        }
        const originX = child.getData("originX") as number;
        const originY = child.getData("originY") as number;
        const travel = phase === 1 ? 42 : phase === 2 ? 76 : 110;
        child.body.setVelocityX(Math.sin(time / (700 - phase * 90)) * travel);
        child.body.setVelocityY((originY - child.y) * 1.3);
        if (Math.abs(child.x - originX) > 145) child.x = originX + Math.sign(child.x - originX) * 145;

        const nextAttackAt = child.getData("nextAttackAt") as number;
        if (time >= nextAttackAt) {
          child.setData("nextAttackAt", time + 360);
          bossSprite.setTint(0xffd166);
          this.time.delayedCall(230, () => {
            if (!child.active || this.phase !== "playing") return;
            bossSprite.clearTint();
            child.setData("nextAttackAt", this.elapsedMs + (bridge.assist ? 1_250 : 960) - phase * 90);
            const spread = phase === 1 ? [0] : phase === 2 ? [-34, 34] : [-52, 0, 52];
            spread.forEach((offset) => {
              this.fireHostileProjectile(
                child.x,
                child.y + 20,
                this.player.x + offset,
                this.player.y,
                this.elapsedMs,
                (bridge.assist ? 130 : 165) + phase * 10,
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
      projectile.setDepth(10).setData("expiresAt", time + 3_000);
      (projectile.body as Phaser.Physics.Arcade.Body)
        .setAllowGravity(false)
        .setVelocity(direction.x, direction.y);
      this.hostileProjectiles.add(projectile);
    }

    private updateProjectiles(time: number) {
      [this.playerProjectiles, this.hostileProjectiles].forEach((group) => {
        group.getChildren().forEach((child) => {
          if (!isBodyObject(child)) return;
          const expiresAt = child.getData("expiresAt") as number;
          if (
            time >= expiresAt ||
            child.x < -32 ||
            child.x > WORLD_WIDTH + 32 ||
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
        this.player.y - GAME_HEIGHT * 0.65,
        0,
        WORLD_HEIGHT - GAME_HEIGHT,
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
      if (kind === "voice") {
        this.voices += 1;
        this.strofe = Math.floor(this.voices / 3);
        if (this.voices % 3 === 0) this.shield = true;
      } else if (kind === "breath") {
        this.breath = Math.min(COMBAT.maxBreath, this.breath + 46);
      } else if (kind === "rima") {
        this.rimaUntil = this.elapsedMs + COMBAT.rimaDurationMs;
      } else {
        this.shield = true;
      }
      pickup.destroy();
      this.emitAudio("pickup");
      this.emitSnapshot(true);
    }

    private damageEnemy(enemy: BodyObject) {
      const hp = (enemy.getData("hp") as number) - 1;
      enemy.setData("hp", hp);
      if (hp <= 0) {
        enemy.destroy();
      } else if ("setTintFill" in enemy) {
        (enemy as Phaser.Physics.Arcade.Sprite).setTintFill();
        this.time.delayedCall(70, () => {
          if (enemy.active && "clearTint" in enemy) (enemy as Phaser.Physics.Arcade.Sprite).clearTint();
        });
      }
    }

    private damageBoss(boss: BodyObject) {
      const hp = Math.max(0, (boss.getData("hp") as number) - 1);
      boss.setData("hp", hp);
      this.emitAudio("boss-hit");
      if (!bridge.reducedMotion) this.cameras.main.shake(55, 0.0025);
      if (hp > 0) return;

      const id = boss.getData("id") as BossId;
      const gate = this.bossGates.get(id);
      if (gate) {
        this.staticPlatforms.remove(gate);
        gate.destroy();
        this.bossGates.delete(id);
      }
      boss.destroy();
      if (this.activeBoss === boss) this.activeBoss = null;
      this.emitAnnouncement(`${BOSS_NAMES[id]} si dissolve in lettere.`);
      this.emitAudio("checkpoint");
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
        this.invulnerableUntil = this.elapsedMs + (bridge.assist ? ASSIST_PLAYER.invulnerableMs : PLAYER.invulnerableMs);
        this.emitAudio("hit");
        if (isFall) this.respawnAtCheckpoint();
        return;
      }

      this.lives -= 1;
      this.phase = "dying";
      this.hitUntil = this.elapsedMs + 800;
      this.statusText = `${reason} — ${Math.max(0, this.lives)} vite`;
      this.emitAudio("hit");
      const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
      playerBody.stop();
      playerBody.enable = false;
      this.player.setTint(0xff4f73).setAlpha(0.55);
      this.clearThreatsNearCheckpoint();
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
        this.respawnAtCheckpoint();
        this.phase = "playing";
        this.statusText = CIRCLE_LEVELS[this.checkpointActIndex * 3].title;
        this.emitSnapshot(true);
      });
    }

    private respawnAtCheckpoint() {
      const spawn =
        this.checkpointSpawns.get(this.checkpointActIndex) ??
        this.checkpointSpawns.get(0) ??
        new PhaserRuntime.Math.Vector2(GAME_WIDTH / 2, WORLD_HEIGHT - 80);
      const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
      playerBody.enable = true;
      this.player.setPosition(spawn.x, spawn.y).setAlpha(1).clearTint();
      this.landedUntil = this.elapsedMs + 220;
      if (this.authoredPlayer && this.anims.exists("davide-respawn")) {
        this.player.anims.play("davide-respawn", true);
      }
      playerBody.reset(spawn.x, spawn.y);
      playerBody.setVelocity(0, 0);
      this.invulnerableUntil = this.elapsedMs + (bridge.assist ? ASSIST_PLAYER.invulnerableMs : PLAYER.invulnerableMs);
      this.breath = Math.max(this.breath, 48);
      bridge.input.moveX = 0;
      bridge.input.jumpPressed = false;
      bridge.input.jumpHeld = false;
      bridge.input.firePressed = false;
      bridge.input.fireHeld = false;
      const cameraY = PhaserRuntime.Math.Clamp(spawn.y - GAME_HEIGHT * 0.65, 0, WORLD_HEIGHT - GAME_HEIGHT);
      this.cameras.main.scrollY = cameraY;
    }

    private clearThreatsNearCheckpoint() {
      this.hostileProjectiles.clear(true, true);
      const spawn = this.checkpointSpawns.get(this.checkpointActIndex);
      if (!spawn) return;
      this.enemies.getChildren().forEach((child) => {
        if (!isBodyObject(child)) return;
        if (PhaserRuntime.Math.Distance.Between(child.x, child.y, spawn.x, spawn.y) < 105) child.destroy();
      });
    }

    private completeRun() {
      if (this.phase === "complete") return;
      this.phase = "complete";
      this.statusText = "E quindi uscimmo a riveder le stelle";
      this.physics.pause();
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
