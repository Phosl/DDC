import { describe, expect, it } from "vitest";

import {
  CIRCLE_IDS,
  CIRCLE_LEVELS,
  LEVEL_COLUMNS,
  LEVEL_HEIGHT,
  LEVEL_ROWS,
  LEVEL_SYMBOLS,
  TILE_SIZE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  assertValidCircleLevels,
  getCircleForWorldY,
  getLevelWorldOffsetY,
  validateCircleLevels,
  worldYToQuota,
  type CircleLevelDefinition,
  type LevelSymbol,
} from "../../src/lib/rise-game/level-data";

const count = (level: CircleLevelDefinition, symbol: LevelSymbol) =>
  level.rows.reduce((total, row) => total + [...row].filter((cell) => cell === symbol).length, 0);

describe("Cantica Zero world data", () => {
  it("uses the agreed portrait tile geometry", () => {
    expect(TILE_SIZE).toBe(16);
    expect([LEVEL_COLUMNS, LEVEL_ROWS]).toEqual([24, 64]);
    expect([WORLD_WIDTH, LEVEL_HEIGHT, WORLD_HEIGHT]).toEqual([384, 1024, 9216]);
  });

  it("contains nine circles ordered from the ninth to the first", () => {
    expect(CIRCLE_LEVELS.map((level) => level.id)).toEqual(CIRCLE_IDS);
    expect(CIRCLE_LEVELS.map((level) => level.orderFromBottom)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(CIRCLE_LEVELS.map((level) => level.actIndex)).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2]);
    expect(CIRCLE_LEVELS.map((level) => level.theme)).toEqual([
      "giudecca",
      "giudecca",
      "giudecca",
      "dite",
      "dite",
      "dite",
      "stelle",
      "stelle",
      "stelle",
    ]);
  });

  it("places checkpoints and bosses at act boundaries", () => {
    expect(CIRCLE_LEVELS.filter((level) => level.checkpoint).map((level) => level.id)).toEqual(["IX", "VI", "III"]);
    expect(CIRCLE_LEVELS.filter((level) => level.boss).map(({ id, boss }) => [id, boss])).toEqual([
      ["VII", "minotaur"],
      ["IV", "pluto"],
      ["I", "charon"],
    ]);
  });

  it("opens every boss ceiling after its gate is defeated", () => {
    CIRCLE_LEVELS.filter((level) => level.boss).forEach((level) => {
      const exitColumn = level.rows.find((row) => row.includes("X"))?.indexOf("X") ?? -1;
      const ceiling = level.rows[2].slice(Math.max(0, exitColumn - 2), exitColumn + 3);
      expect(ceiling).not.toContain("#");
      expect(ceiling).toContain("-");
    });
  });

  it("builds valid 24 by 64 ASCII maps with complete pickup sets", () => {
    for (const level of CIRCLE_LEVELS) {
      expect(level.rows).toHaveLength(LEVEL_ROWS);
      expect(level.rows.every((row) => row.length === LEVEL_COLUMNS)).toBe(true);
      expect(level.rows.flatMap((row) => [...row]).every((symbol) => symbol in LEVEL_SYMBOLS)).toBe(true);
      expect(count(level, "S")).toBe(1);
      expect(count(level, "X")).toBe(1);
      expect(count(level, "P")).toBe(3);
      expect(count(level, "B")).toBeGreaterThanOrEqual(1);
      expect(count(level, "R")).toBeGreaterThanOrEqual(1);
      expect(count(level, "L")).toBeGreaterThanOrEqual(1);
      expect(count(level, "E") + count(level, "F")).toBeGreaterThanOrEqual(1);
    }
    expect(validateCircleLevels()).toEqual([]);
    expect(() => assertValidCircleLevels()).not.toThrow();
  });

  it("keeps every authored jump inside the base physics envelope", () => {
    const platformSymbols = new Set(["#", "-", "H", "V", "C"]);

    for (const level of CIRCLE_LEVELS) {
      level.route.forEach((node, index) => {
        expect(platformSymbols.has(level.rows[node.row][node.column])).toBe(true);
        const previous = level.route[index - 1];
        if (!previous) return;
        expect(previous.row - node.row).toBeGreaterThanOrEqual(1);
        expect(previous.row - node.row).toBeLessThanOrEqual(5);
        expect(Math.abs(previous.column - node.column)).toBeLessThanOrEqual(6);
      });
    }
  });

  it("keeps adjacent circle seams open and horizontally aligned", () => {
    CIRCLE_LEVELS.slice(1).forEach((level, index) => {
      const previous = CIRCLE_LEVELS[index];
      const previousExitColumn = previous.rows[1].indexOf("X");
      const entryColumn = level.rows.find((row) => row.includes("S"))?.indexOf("S") ?? -1;

      expect(Math.abs(previousExitColumn - entryColumn)).toBeLessThanOrEqual(1);
      expect(level.rows[LEVEL_ROWS - 1].slice(entryColumn - 2, entryColumn + 3)).toBe("     ");
      expect(level.rows[level.route[0].row][level.route[0].column]).toBe("-");
    });
  });

  it("maps the stacked world to circles and quota without seams", () => {
    CIRCLE_LEVELS.forEach((level) => {
      const offset = getLevelWorldOffsetY(level.orderFromBottom);
      expect(offset).toBe(WORLD_HEIGHT - (level.orderFromBottom + 1) * LEVEL_HEIGHT);
      expect(getCircleForWorldY(offset + LEVEL_HEIGHT / 2).id).toBe(level.id);
    });
    expect(getCircleForWorldY(0).id).toBe("I");
    expect(getCircleForWorldY(WORLD_HEIGHT).id).toBe("IX");
    expect(worldYToQuota(WORLD_HEIGHT)).toBe(-900);
    expect(worldYToQuota(WORLD_HEIGHT / 2)).toBe(-450);
    expect(worldYToQuota(0)).toBe(0);
  });

  it("reports malformed maps with actionable validation issues", () => {
    const source = CIRCLE_LEVELS[0];
    const brokenRows = [...source.rows];
    brokenRows[0] = brokenRows[0].slice(0, -1);
    const malformed: CircleLevelDefinition = { ...source, rows: brokenRows };
    const levels = [malformed, ...CIRCLE_LEVELS.slice(1)];

    expect(validateCircleLevels(levels)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "dimensions", levelId: "IX", row: 0 }),
      ]),
    );
    expect(() => assertValidCircleLevels(levels)).toThrow(/Invalid Cantica Zero level data/);
    expect(() => getLevelWorldOffsetY(9)).toThrow(RangeError);
  });
});
