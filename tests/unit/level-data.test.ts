import { describe, expect, it } from "vitest";

import {
  CIRCLE_IDS,
  CIRCLE_LEVELS,
  LEVEL_CURVE,
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
import { DIFFICULTY_TUNING } from "../../src/lib/rise-game/difficulty";

const count = (level: CircleLevelDefinition, symbol: LevelSymbol) =>
  level.rows.reduce((total, row) => total + [...row].filter((cell) => cell === symbol).length, 0);

const countFragilePlatforms = (level: CircleLevelDefinition) =>
  level.rows.reduce((total, row) => total + (row.match(/C+/g)?.length ?? 0), 0);

const movingPhases = [-1, 0, 1] as const;

function expectReachableAtEveryMovingPhase(
  source: { readonly x: number; readonly y: number; readonly symbol: LevelSymbol },
  target: { readonly x: number; readonly y: number; readonly symbol: LevelSymbol },
  label: string,
) {
  for (const [mode, { player, platforms }] of Object.entries(DIFFICULTY_TUNING)) {
    const jumpSpeed = Math.abs(player.jumpVelocity);

    for (const sourcePhase of movingPhases) {
      for (const targetPhase of movingPhases) {
        const sourceX = source.x + (source.symbol === "H" ? sourcePhase * platforms.horizontalRange : 0);
        const targetX = target.x + (target.symbol === "H" ? targetPhase * platforms.horizontalRange : 0);
        const sourceY = source.y + (source.symbol === "V" ? sourcePhase * platforms.verticalRange : 0);
        const targetY = target.y + (target.symbol === "V" ? targetPhase * platforms.verticalRange : 0);
        const rise = sourceY - targetY;
        const discriminant = jumpSpeed ** 2 - 2 * player.gravity * rise;

        expect(
          discriminant,
          `${mode} ${label}: vertical phase ${sourcePhase}->${targetPhase}`,
        ).toBeGreaterThanOrEqual(0);

        const descendingFlightSeconds = (jumpSpeed + Math.sqrt(Math.max(0, discriminant))) / player.gravity;
        const targetPlatformWidth =
          target.symbol === "H" || target.symbol === "V"
            ? platforms.movingWidth
            : 5 * TILE_SIZE;
        const landingTolerance = (targetPlatformWidth + player.width) / 2;
        const requiredHorizontalTravel = Math.max(0, Math.abs(targetX - sourceX) - landingTolerance);

        expect(
          requiredHorizontalTravel,
          `${mode} ${label}: horizontal phase ${sourcePhase}->${targetPhase}`,
        ).toBeLessThanOrEqual(player.speed * descendingFlightSeconds);
      }
    }
  }
}

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

  it("follows the authored platform and enemy ramp from IX to I", () => {
    expect(LEVEL_CURVE).toEqual({
      IX: { fragile: 1, horizontal: 1, vertical: 0, enemies: 3 },
      VIII: { fragile: 2, horizontal: 2, vertical: 1, enemies: 4 },
      VII: { fragile: 2, horizontal: 2, vertical: 2, enemies: 4 },
      VI: { fragile: 2, horizontal: 2, vertical: 1, enemies: 4 },
      V: { fragile: 2, horizontal: 3, vertical: 2, enemies: 5 },
      IV: { fragile: 2, horizontal: 3, vertical: 2, enemies: 4 },
      III: { fragile: 2, horizontal: 2, vertical: 1, enemies: 4 },
      II: { fragile: 2, horizontal: 4, vertical: 3, enemies: 5 },
      I: { fragile: 3, horizontal: 3, vertical: 2, enemies: 4 },
    });

    for (const level of CIRCLE_LEVELS) {
      expect({
        fragile: countFragilePlatforms(level),
        horizontal: count(level, "H"),
        vertical: count(level, "V"),
        enemies: count(level, "E") + count(level, "F"),
      }).toEqual(LEVEL_CURVE[level.id]);
    }
  });

  it("teaches the opening with six consecutive 48-unit jumps", () => {
    const tutorial = CIRCLE_LEVELS[0];
    const openingRises = tutorial.route
      .slice(1, 7)
      .map((node, index) => (tutorial.route[index].row - node.row) * TILE_SIZE);

    expect(tutorial.id).toBe("IX");
    expect(openingRises).toEqual([48, 48, 48, 48, 48, 48]);
    for (const { player } of Object.values(DIFFICULTY_TUNING)) {
      const shortJumpRise = (Math.abs(player.jumpVelocity) * player.jumpCutMultiplier) ** 2 / (2 * player.gravity);
      expect(shortJumpRise).toBeGreaterThanOrEqual(48);
    }
  });

  it("puts early protection and a Fiato refill before every boss arena", () => {
    for (const level of CIRCLE_LEVELS) {
      expect(level.rows[level.route[2].row - 1]).toContain("L");

      if (!level.boss) continue;
      const preArena = level.route.at(-4);
      expect(preArena).toBeDefined();
      expect(level.rows[preArena!.row - 1]).toContain("B");
    }
  });

  it("keeps the final three boss approaches clear of common enemies", () => {
    for (const level of CIRCLE_LEVELS.filter((candidate) => candidate.boss)) {
      for (const node of level.route.slice(-3)) {
        expect(level.rows[node.row - 1]).not.toMatch(/[EF]/);
      }
    }
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

  it("keeps every route and inter-circle seam reachable at all moving-platform extremes", () => {
    CIRCLE_LEVELS.forEach((level, levelIndex) => {
      const offsetY = getLevelWorldOffsetY(level.orderFromBottom);
      const worldNode = (node: (typeof level.route)[number]) => ({
        x: node.column * TILE_SIZE,
        y: offsetY + node.row * TILE_SIZE,
        symbol: level.rows[node.row][node.column] as LevelSymbol,
      });

      level.route.slice(1).forEach((node, routeIndex) => {
        expectReachableAtEveryMovingPhase(
          worldNode(level.route[routeIndex]),
          worldNode(node),
          `${level.id} ${routeIndex}->${routeIndex + 1}`,
        );
      });

      const nextLevel = CIRCLE_LEVELS[levelIndex + 1];
      if (!nextLevel) return;
      const nextOffsetY = getLevelWorldOffsetY(nextLevel.orderFromBottom);
      const sourceNode = level.route.at(-1)!;
      const targetNode = nextLevel.route[0];
      expectReachableAtEveryMovingPhase(
        worldNode(sourceNode),
        {
          x: targetNode.column * TILE_SIZE,
          y: nextOffsetY + targetNode.row * TILE_SIZE,
          symbol: nextLevel.rows[targetNode.row][targetNode.column] as LevelSymbol,
        },
        `${level.id}->${nextLevel.id} seam`,
      );
    });
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

  it("rejects maps whose authored difficulty budget drifts", () => {
    const source = CIRCLE_LEVELS[0];
    const enemyRow = source.rows.findIndex((row) => /[EF]/.test(row));
    const enemyColumn = source.rows[enemyRow].search(/[EF]/);
    const brokenRows = [...source.rows];
    brokenRows[enemyRow] = `${brokenRows[enemyRow].slice(0, enemyColumn)} ${brokenRows[enemyRow].slice(enemyColumn + 1)}`;
    const malformed: CircleLevelDefinition = { ...source, rows: brokenRows };

    expect(validateCircleLevels([malformed, ...CIRCLE_LEVELS.slice(1)])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "difficulty-budget", levelId: "IX" }),
      ]),
    );
  });
});
