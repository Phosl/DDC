import { describe, expect, it } from "vitest";

import { GameAudioEngine } from "../../src/lib/game-audio";
import { GAME_AUDIO_CUES, type GameAudioCue } from "../../src/lib/rise-game/types";

const LEGACY_CUES = [
  "jump",
  "land",
  "verse",
  "hit",
  "pickup",
  "checkpoint",
  "boss-enter",
  "boss-hit",
  "complete",
  "game-over",
] as const satisfies readonly GameAudioCue[];

const DETAIL_CUES = [
  "enemy-hit",
  "enemy-break",
  "boss-telegraph",
  "boss-break",
  "shield-break",
  "respawn",
  "land-hard",
] as const satisfies readonly GameAudioCue[];

type AudioHarness = {
  canPlay: () => boolean;
  playTone: (
    startFrequency: number,
    endFrequency: number,
    type: OscillatorType,
    delay: number,
    duration: number,
    level: number,
  ) => void;
  playNoiseBurst: (frequency: number, duration: number, level: number) => void;
  playChord: (
    frequencies: number[],
    spacing: number,
    duration: number,
    type: OscillatorType,
  ) => void;
};

function captureRecipe(engine: GameAudioEngine, cue: GameAudioCue) {
  const recipe: Array<readonly [string, ...unknown[]]> = [];
  const harness = engine as unknown as AudioHarness;
  harness.canPlay = () => true;
  harness.playTone = (...parameters) => recipe.push(["tone", ...parameters]);
  harness.playNoiseBurst = (...parameters) => recipe.push(["noise", ...parameters]);
  harness.playChord = (...parameters) => recipe.push(["chord", ...parameters]);
  engine.playCue(cue);
  return recipe;
}

describe("game audio cue contract", () => {
  it("keeps every legacy cue while exposing the new gameplay details", () => {
    expect(new Set(GAME_AUDIO_CUES).size).toBe(GAME_AUDIO_CUES.length);
    expect(GAME_AUDIO_CUES).toEqual(expect.arrayContaining([...LEGACY_CUES, ...DETAIL_CUES]));
  });

  it("gives every detailed visual event its own non-empty procedural recipe", () => {
    const engine = new GameAudioEngine();
    const recipes = DETAIL_CUES.map((cue) => captureRecipe(engine, cue));
    const signatures = recipes.map((recipe) => JSON.stringify(recipe));

    expect(recipes.every((recipe) => recipe.length > 0)).toBe(true);
    expect(new Set(signatures).size).toBe(DETAIL_CUES.length);
    engine.dispose();
  });

  it("keeps all new transient levels below the existing player-hit peak", () => {
    const engine = new GameAudioEngine();

    for (const cue of DETAIL_CUES) {
      const recipe = captureRecipe(engine, cue);
      const explicitLevels = recipe
        .filter(([kind]) => kind === "tone" || kind === "noise")
        .map((entry) => entry.at(-1))
        .filter((level): level is number => typeof level === "number");

      expect(explicitLevels.every((level) => level < 0.11)).toBe(true);
    }

    engine.dispose();
  });
});
