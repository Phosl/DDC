import type { GameEvent, GameInput, GameSnapshot } from "./types";

export type SceneRestartMode = "full-run" | "continue-act";

export interface AscentSceneHandle {
  pauseGame(reason?: string): void;
  resumeGame(): void;
  restartGame(mode: SceneRestartMode): void;
  setAssist(enabled: boolean): void;
  setReducedMotion(enabled: boolean): void;
  verifyCampaign(): GameSnapshot;
}

export type RuntimeBridge = {
  input: GameInput;
  assist: boolean;
  reducedMotion: boolean;
  desiredRunning: boolean;
  pendingRestart: SceneRestartMode | null;
  destroyed: boolean;
  scene: AscentSceneHandle | null;
  onSnapshot: (snapshot: GameSnapshot) => void;
  onEvent: (event: GameEvent) => void;
};
