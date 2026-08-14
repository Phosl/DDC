import type Phaser from "phaser";

import { GAME_HEIGHT, GAME_WIDTH, PLAYER, WORLD_HEIGHT, WORLD_WIDTH } from "./config";
import { createAscentScene } from "./ascent-scene";
import type { RuntimeBridge } from "./internal";
import { mergeGameInput } from "./rules";
import {
  INITIAL_GAME_INPUT,
  type CreateRiseGameOptions,
  type GameController,
} from "./types";

type PhaserNamespace = typeof Phaser;

export async function createRiseGame(
  options: CreateRiseGameOptions,
): Promise<GameController> {
  if (typeof window === "undefined") {
    throw new Error("Cantica Zero può essere avviato soltanto nel browser.");
  }

  const imported = await import("phaser");
  const PhaserRuntime = ("default" in imported
    ? imported.default
    : imported) as unknown as PhaserNamespace;

  const bridge: RuntimeBridge = {
    input: { ...INITIAL_GAME_INPUT },
    assist: options.assist ?? false,
    reducedMotion: options.reducedMotion ?? false,
    desiredRunning: false,
    pendingRestart: null,
    destroyed: false,
    scene: null,
    onSnapshot: options.onSnapshot,
    onEvent: options.onEvent ?? (() => undefined),
  };

  const scene = createAscentScene(PhaserRuntime, bridge);
  const game = new PhaserRuntime.Game({
    type: PhaserRuntime.AUTO,
    parent: options.parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    title: "Cantica Zero",
    version: "2.0.0",
    backgroundColor: "#08131c",
    banner: false,
    input: false,
    autoFocus: false,
    scene,
    fps: {
      target: 60,
      panicMax: 6,
      smoothStep: true,
    },
    render: {
      pixelArt: true,
      antialias: false,
      roundPixels: true,
      powerPreference: "high-performance",
    },
    scale: {
      mode: PhaserRuntime.Scale.FIT,
      autoCenter: PhaserRuntime.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: PLAYER.gravity },
        x: 0,
        y: 0,
        width: WORLD_WIDTH,
        height: WORLD_HEIGHT,
        fps: 60,
        fixedStep: true,
        maxEntries: 24,
      },
    },
    callbacks: {
      postBoot(bootedGame) {
        const canvas = bootedGame.canvas;
        canvas.dataset.testid = "rise-game-canvas";
        canvas.setAttribute("aria-label", "Cantica Zero — area di gioco");
        canvas.setAttribute("role", "img");
      },
    },
  });

  let destroyed = false;
  return {
    setInput(input) {
      if (destroyed) return;
      bridge.input = mergeGameInput(bridge.input, input);
    },
    clearInput() {
      if (destroyed) return;
      bridge.input = { ...INITIAL_GAME_INPUT };
    },
    pause(reason) {
      if (destroyed) return;
      bridge.input = { ...INITIAL_GAME_INPUT };
      bridge.desiredRunning = false;
      bridge.scene?.pauseGame(reason);
    },
    resume() {
      if (destroyed) return;
      bridge.desiredRunning = true;
      bridge.scene?.resumeGame();
    },
    restart(mode) {
      if (destroyed) return;
      bridge.pendingRestart = bridge.scene ? null : mode;
      bridge.scene?.restartGame(mode);
    },
    setAssist(enabled) {
      if (destroyed) return;
      bridge.assist = enabled;
      bridge.scene?.setAssist(enabled);
    },
    setReducedMotion(enabled) {
      if (destroyed) return;
      bridge.reducedMotion = enabled;
      bridge.scene?.setReducedMotion(enabled);
    },
    verifyCampaign:
      process.env.NODE_ENV === "production"
        ? undefined
        : () => {
            if (destroyed || !bridge.scene) {
              throw new Error("Cantica Zero is not ready for verification.");
            }
            return bridge.scene.verifyCampaign();
          },
    verifyDamageRespawn:
      process.env.NODE_ENV === "production"
        ? undefined
        : async () => {
            if (destroyed || !bridge.scene) {
              throw new Error("Cantica Zero is not ready for verification.");
            }
            return bridge.scene.verifyDamageRespawn();
          },
    readTelemetry:
      process.env.NODE_ENV === "production"
        ? undefined
        : () => {
            if (destroyed || !bridge.scene) {
              throw new Error("Cantica Zero is not ready for telemetry.");
            }
            return bridge.scene.readTelemetry();
          },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      bridge.destroyed = true;
      bridge.desiredRunning = false;
      bridge.scene = null;
      const ownedCanvas = game.canvas;
      game.destroy(true);
      ownedCanvas?.remove();
    },
  };
}
