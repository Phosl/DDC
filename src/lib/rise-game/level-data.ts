export const TILE_SIZE = 16;
export const LEVEL_COLUMNS = 24;
export const LEVEL_ROWS = 64;
export const LEVEL_HEIGHT = LEVEL_ROWS * TILE_SIZE;
export const WORLD_WIDTH = LEVEL_COLUMNS * TILE_SIZE;
export const WORLD_HEIGHT = 9 * LEVEL_HEIGHT;

export const CIRCLE_IDS = ["IX", "VIII", "VII", "VI", "V", "IV", "III", "II", "I"] as const;

export type CircleId = (typeof CIRCLE_IDS)[number];
export type ActIndex = 0 | 1 | 2;
export type LevelTheme = "giudecca" | "dite" | "stelle";
export type BossId = "minotaur" | "pluto" | "charon";
export type PlatformSymbol = "#" | "-" | "H" | "V" | "C";

export const LEVEL_SYMBOLS = {
  " ": "aria",
  "#": "terreno statico",
  "-": "pedana attraversabile dal basso",
  H: "pedana mobile orizzontale",
  V: "pedana mobile verticale",
  C: "pedana fragile",
  E: "nemico terrestre",
  F: "nemico volante",
  P: "frammento di Voce",
  B: "ricarica Fiato",
  R: "Rima",
  L: "Luce",
  S: "punto di ingresso",
  X: "uscita o soglia del boss",
} as const;

export type LevelSymbol = keyof typeof LEVEL_SYMBOLS;

export type LevelMechanic =
  | "ice"
  | "false-platforms"
  | "switches"
  | "chains"
  | "elevators"
  | "gates"
  | "tombs"
  | "rafts"
  | "knockback"
  | "counterweights"
  | "rolling-stones"
  | "sticky"
  | "rain"
  | "wind"
  | "memory-platforms";

export interface RouteNode {
  /** Column and row of the surface tile or moving-platform origin. */
  readonly column: number;
  readonly row: number;
}

export interface CircleLevelDefinition {
  readonly id: CircleId;
  readonly title: string;
  readonly actIndex: ActIndex;
  readonly orderFromBottom: number;
  readonly checkpoint: boolean;
  readonly boss?: BossId;
  readonly theme: LevelTheme;
  readonly mechanics: readonly LevelMechanic[];
  readonly rows: readonly string[];
  /** Authored bottom-to-top critical path, used to validate jump geometry. */
  readonly route: readonly RouteNode[];
}

export interface LevelCurveBudget {
  readonly fragile: number;
  readonly horizontal: number;
  readonly vertical: number;
  readonly enemies: number;
}

/**
 * The authored difficulty ramp. Counts refer to platform instances rather
 * than occupied tiles; enemies excludes the three act custodians.
 */
export const LEVEL_CURVE: Readonly<Record<CircleId, LevelCurveBudget>> = Object.freeze({
  IX: Object.freeze({ fragile: 1, horizontal: 1, vertical: 0, enemies: 3 }),
  VIII: Object.freeze({ fragile: 2, horizontal: 2, vertical: 1, enemies: 4 }),
  VII: Object.freeze({ fragile: 2, horizontal: 2, vertical: 2, enemies: 4 }),
  VI: Object.freeze({ fragile: 2, horizontal: 2, vertical: 1, enemies: 4 }),
  V: Object.freeze({ fragile: 2, horizontal: 3, vertical: 2, enemies: 5 }),
  IV: Object.freeze({ fragile: 2, horizontal: 3, vertical: 2, enemies: 4 }),
  III: Object.freeze({ fragile: 2, horizontal: 2, vertical: 1, enemies: 4 }),
  II: Object.freeze({ fragile: 2, horizontal: 4, vertical: 3, enemies: 5 }),
  I: Object.freeze({ fragile: 3, horizontal: 3, vertical: 2, enemies: 4 }),
});

export interface LevelValidationIssue {
  readonly code:
    | "level-count"
    | "level-order"
    | "duplicate-id"
    | "duplicate-order"
    | "dimensions"
    | "unknown-symbol"
    | "marker-count"
    | "marker-position"
    | "pickup-count"
    | "checkpoint"
    | "boss"
    | "difficulty-budget"
    | "route";
  readonly message: string;
  readonly levelId?: CircleId;
  readonly row?: number;
  readonly column?: number;
}

interface PlatformSpec extends RouteNode {
  readonly width: number;
  readonly symbol: PlatformSymbol;
}

interface MarkerSpec extends RouteNode {
  readonly symbol: Exclude<LevelSymbol, " " | PlatformSymbol>;
}

interface LevelLayoutSpec extends Omit<CircleLevelDefinition, "rows" | "route"> {
  readonly routeRows?: readonly number[];
  readonly x: readonly number[];
  readonly kinds: readonly PlatformSymbol[];
  readonly enemies: readonly RouteMarkerSpec[];
  readonly extras?: readonly PlatformSpec[];
}

interface RouteMarkerSpec {
  readonly routeIndex: number;
  readonly symbol: "E" | "F";
  readonly offset?: number;
}

const ROUTE_ROWS = [62, 58, 54, 50, 46, 42, 38, 34, 30, 26, 22, 18, 14, 10, 6, 3] as const;

const LEVEL_LAYOUTS: readonly LevelLayoutSpec[] = [
  {
    id: "IX",
    title: "Giudecca",
    actIndex: 0,
    orderFromBottom: 0,
    checkpoint: true,
    theme: "giudecca",
    mechanics: ["ice"],
    routeRows: [62, 59, 56, 53, 50, 47, 44, 40, 36, 32, 28, 24, 20, 16, 12, 9, 6, 3],
    x: [5, 8, 11, 14, 17, 19, 16, 12, 8, 5, 9, 13, 17, 19, 15, 11, 14, 16],
    kinds: ["#", "-", "-", "-", "-", "-", "-", "H", "-", "-", "-", "C", "-", "-", "-", "-", "-", "#"],
    enemies: [
      { routeIndex: 4, symbol: "E", offset: 1 },
      { routeIndex: 8, symbol: "E", offset: -1 },
      { routeIndex: 11, symbol: "F", offset: 2 },
    ],
  },
  {
    id: "VIII",
    title: "Malebolge",
    actIndex: 0,
    orderFromBottom: 1,
    checkpoint: false,
    theme: "giudecca",
    mechanics: ["false-platforms", "switches"],
    x: [17, 13, 8, 5, 9, 14, 18, 15, 10, 6, 9, 14, 19, 15, 10, 6],
    kinds: ["#", "-", "-", "H", "C", "-", "-", "V", "-", "H", "-", "C", "-", "-", "-", "#"],
    enemies: [
      { routeIndex: 4, symbol: "E", offset: 1 },
      { routeIndex: 6, symbol: "E", offset: -1 },
      { routeIndex: 10, symbol: "E", offset: 1 },
      { routeIndex: 12, symbol: "F", offset: -2 },
    ],
  },
  {
    id: "VII",
    title: "Flegetonte",
    actIndex: 0,
    orderFromBottom: 2,
    checkpoint: false,
    boss: "minotaur",
    theme: "giudecca",
    mechanics: ["chains", "elevators"],
    x: [6, 10, 15, 19, 15, 10, 5, 9, 14, 18, 14, 9, 5, 10, 15, 12],
    kinds: ["#", "-", "-", "H", "C", "-", "V", "-", "H", "-", "C", "V", "-", "-", "-", "#"],
    enemies: [
      { routeIndex: 4, symbol: "E", offset: 1 },
      { routeIndex: 7, symbol: "E", offset: -1 },
      { routeIndex: 9, symbol: "E", offset: 1 },
      { routeIndex: 12, symbol: "F", offset: -2 },
    ],
    extras: [{ column: 12, row: 2, width: 16, symbol: "-" }],
  },
  {
    id: "VI",
    title: "Dite",
    actIndex: 1,
    orderFromBottom: 3,
    checkpoint: true,
    theme: "dite",
    mechanics: ["gates", "tombs"],
    x: [12, 14, 9, 5, 8, 13, 18, 14, 9, 5, 10, 15, 19, 14, 9, 5],
    kinds: ["#", "-", "-", "H", "C", "-", "-", "V", "-", "H", "C", "-", "-", "-", "-", "#"],
    enemies: [
      { routeIndex: 4, symbol: "E", offset: 1 },
      { routeIndex: 7, symbol: "E", offset: -1 },
      { routeIndex: 10, symbol: "E", offset: 1 },
      { routeIndex: 13, symbol: "F", offset: -2 },
    ],
    extras: [
      { column: 3, row: 36, width: 4, symbol: "#" },
      { column: 21, row: 20, width: 4, symbol: "#" },
    ],
  },
  {
    id: "V",
    title: "Stige",
    actIndex: 1,
    orderFromBottom: 4,
    checkpoint: false,
    theme: "dite",
    mechanics: ["rafts", "knockback"],
    x: [5, 10, 15, 19, 14, 9, 5, 10, 15, 19, 14, 9, 5, 9, 14, 18],
    kinds: ["#", "-", "H", "-", "V", "C", "H", "V", "-", "-", "C", "-", "H", "-", "-", "#"],
    enemies: [
      { routeIndex: 4, symbol: "E", offset: 1 },
      { routeIndex: 7, symbol: "E", offset: -1 },
      { routeIndex: 10, symbol: "E", offset: 1 },
      { routeIndex: 12, symbol: "F", offset: -2 },
      { routeIndex: 14, symbol: "F", offset: 2 },
    ],
  },
  {
    id: "IV",
    title: "Avari e prodighi",
    actIndex: 1,
    orderFromBottom: 5,
    checkpoint: false,
    boss: "pluto",
    theme: "dite",
    mechanics: ["counterweights", "rolling-stones"],
    x: [17, 12, 7, 4, 9, 14, 19, 15, 10, 5, 9, 14, 18, 13, 8, 12],
    kinds: ["#", "-", "-", "H", "C", "V", "-", "H", "-", "V", "C", "H", "-", "-", "-", "#"],
    enemies: [
      { routeIndex: 4, symbol: "E", offset: 1 },
      { routeIndex: 7, symbol: "E", offset: -1 },
      { routeIndex: 10, symbol: "E", offset: 1 },
      { routeIndex: 12, symbol: "F", offset: -2 },
    ],
    extras: [{ column: 12, row: 2, width: 16, symbol: "-" }],
  },
  {
    id: "III",
    title: "Golosi",
    actIndex: 2,
    orderFromBottom: 6,
    checkpoint: true,
    theme: "stelle",
    mechanics: ["sticky", "rain"],
    x: [12, 9, 14, 18, 14, 9, 5, 8, 13, 18, 15, 10, 6, 11, 16, 19],
    kinds: ["#", "-", "-", "H", "C", "-", "-", "V", "H", "-", "C", "-", "-", "-", "-", "#"],
    enemies: [
      { routeIndex: 4, symbol: "E", offset: 1 },
      { routeIndex: 7, symbol: "E", offset: -1 },
      { routeIndex: 10, symbol: "E", offset: 1 },
      { routeIndex: 13, symbol: "F", offset: -2 },
    ],
  },
  {
    id: "II",
    title: "Lussuriosi",
    actIndex: 2,
    orderFromBottom: 7,
    checkpoint: false,
    theme: "stelle",
    mechanics: ["wind"],
    x: [18, 14, 9, 5, 9, 14, 18, 15, 11, 6, 10, 15, 19, 15, 10, 6],
    kinds: ["#", "H", "-", "H", "V", "-", "H", "C", "V", "-", "-", "H", "V", "C", "-", "#"],
    enemies: [
      { routeIndex: 4, symbol: "E", offset: 1 },
      { routeIndex: 6, symbol: "E", offset: -1 },
      { routeIndex: 9, symbol: "E", offset: 1 },
      { routeIndex: 12, symbol: "F", offset: -2 },
      { routeIndex: 14, symbol: "F", offset: 2 },
    ],
  },
  {
    id: "I",
    title: "Limbo / Stelle",
    actIndex: 2,
    orderFromBottom: 8,
    checkpoint: false,
    boss: "charon",
    theme: "stelle",
    mechanics: ["memory-platforms"],
    x: [6, 11, 16, 19, 15, 10, 5, 9, 14, 18, 14, 9, 5, 10, 15, 12],
    kinds: ["#", "-", "-", "H", "C", "V", "-", "H", "-", "C", "V", "H", "C", "-", "-", "#"],
    enemies: [
      { routeIndex: 4, symbol: "E", offset: 1 },
      { routeIndex: 7, symbol: "E", offset: -1 },
      { routeIndex: 10, symbol: "E", offset: 1 },
      { routeIndex: 12, symbol: "F", offset: -2 },
    ],
    extras: [{ column: 12, row: 2, width: 18, symbol: "-" }],
  },
] as const;

function placePlatform(grid: string[][], platform: PlatformSpec) {
  const half = Math.floor(platform.width / 2);
  const from = platform.symbol === "H" || platform.symbol === "V" ? platform.column : platform.column - half;
  const to = platform.symbol === "H" || platform.symbol === "V" ? platform.column : from + platform.width - 1;

  for (let column = from; column <= to; column += 1) {
    if (column > 0 && column < LEVEL_COLUMNS - 1 && platform.row >= 0 && platform.row < LEVEL_ROWS) {
      grid[platform.row][column] = platform.symbol;
    }
  }
}

function placeMarker(grid: string[][], marker: MarkerSpec) {
  grid[marker.row][marker.column] = marker.symbol;
}

function buildLevel(spec: LevelLayoutSpec): CircleLevelDefinition {
  const grid = Array.from({ length: LEVEL_ROWS }, () => Array<LevelSymbol>(LEVEL_COLUMNS).fill(" "));
  const routeRows = spec.routeRows ?? ROUTE_ROWS;
  if (spec.x.length !== routeRows.length || spec.kinds.length !== routeRows.length) {
    throw new Error(`Circle ${spec.id} needs one x coordinate and platform kind for every route row.`);
  }
  const route = routeRows.map((row, index) => ({ column: spec.x[index], row }));

  for (let row = 0; row < LEVEL_ROWS; row += 1) {
    grid[row][0] = "#";
    grid[row][LEVEL_COLUMNS - 1] = "#";
  }
  grid[LEVEL_ROWS - 1].fill("#");
  if (spec.orderFromBottom > 0) {
    for (let column = route[0].column - 2; column <= route[0].column + 2; column += 1) {
      grid[LEVEL_ROWS - 1][column] = " ";
    }
  }

  route.forEach((node, index) => {
    placePlatform(grid, {
      ...node,
      width: index === 0 || index === route.length - 1 ? 9 : 5,
      // Upper segments remain physically connected: the player rises through
      // the floor opening and lands on this one-way entry platform.
      symbol: index === 0 && spec.orderFromBottom > 0 ? "-" : spec.kinds[index],
    });
  });
  spec.extras?.forEach((platform) => placePlatform(grid, platform));

  const markerAt = (index: number, symbol: MarkerSpec["symbol"], offset = 0): MarkerSpec => ({
    column: Math.max(1, Math.min(LEVEL_COLUMNS - 2, route[index].column + offset)),
    row: route[index].row - 1,
    symbol,
  });

  const middleVoiceIndex = Math.floor(route.length / 2);
  const upperVoiceIndex = route.length - 5;
  const rimaIndex = Math.floor((route.length * 2) / 3);
  const breathIndex = spec.boss ? route.length - 4 : 5;

  const markers: MarkerSpec[] = [
    markerAt(0, "S"),
    { column: route.at(-1)?.column ?? 12, row: 1, symbol: "X" },
    markerAt(3, "P", -1),
    markerAt(middleVoiceIndex, "P", 1),
    markerAt(upperVoiceIndex, "P", -1),
    markerAt(breathIndex, "B", 1),
    markerAt(rimaIndex, "R", -1),
    markerAt(2, "L", 1),
    ...spec.enemies.map((enemy) => markerAt(enemy.routeIndex, enemy.symbol, enemy.offset)),
  ];
  markers.forEach((marker) => placeMarker(grid, marker));

  return Object.freeze({
    id: spec.id,
    title: spec.title,
    actIndex: spec.actIndex,
    orderFromBottom: spec.orderFromBottom,
    checkpoint: spec.checkpoint,
    ...(spec.boss ? { boss: spec.boss } : {}),
    theme: spec.theme,
    mechanics: Object.freeze([...spec.mechanics]),
    rows: Object.freeze(grid.map((row) => row.join(""))),
    route: Object.freeze(route),
  });
}

export const CIRCLE_LEVELS: readonly CircleLevelDefinition[] = Object.freeze(LEVEL_LAYOUTS.map(buildLevel));

const PLATFORM_SYMBOLS = new Set<LevelSymbol>(["#", "-", "H", "V", "C"]);
const EXPECTED_CHECKPOINTS = new Set([0, 3, 6]);
const EXPECTED_BOSSES = new Map<number, BossId>([
  [2, "minotaur"],
  [5, "pluto"],
  [8, "charon"],
]);

function countSymbol(level: CircleLevelDefinition, symbol: LevelSymbol) {
  return level.rows.reduce((total, row) => total + [...row].filter((cell) => cell === symbol).length, 0);
}

function countFragilePlatforms(level: CircleLevelDefinition) {
  return level.rows.reduce((total, row) => {
    const runs = row.match(/C+/g);
    return total + (runs?.length ?? 0);
  }, 0);
}

export function getLevelWorldOffsetY(orderFromBottom: number) {
  if (!Number.isInteger(orderFromBottom) || orderFromBottom < 0 || orderFromBottom >= CIRCLE_IDS.length) {
    throw new RangeError(`Invalid circle order: ${orderFromBottom}`);
  }
  return WORLD_HEIGHT - (orderFromBottom + 1) * LEVEL_HEIGHT;
}

export function getCircleForWorldY(worldY: number, levels = CIRCLE_LEVELS) {
  const safeY = Math.max(0, Math.min(WORLD_HEIGHT - Number.EPSILON, worldY));
  const orderFromBottom = CIRCLE_IDS.length - 1 - Math.floor(safeY / LEVEL_HEIGHT);
  return levels.find((level) => level.orderFromBottom === orderFromBottom) ?? levels[0];
}

export function worldYToQuota(worldY: number) {
  const progress = 1 - Math.max(0, Math.min(WORLD_HEIGHT, worldY)) / WORLD_HEIGHT;
  return Math.round(-900 + progress * 900);
}

export function validateCircleLevels(levels: readonly CircleLevelDefinition[] = CIRCLE_LEVELS) {
  const issues: LevelValidationIssue[] = [];
  const ids = new Set<CircleId>();
  const orders = new Set<number>();

  if (levels.length !== CIRCLE_IDS.length) {
    issues.push({ code: "level-count", message: `Expected 9 circles, received ${levels.length}.` });
  }

  levels.forEach((level, arrayIndex) => {
    const issue = (value: Omit<LevelValidationIssue, "levelId">) => issues.push({ ...value, levelId: level.id });

    if (ids.has(level.id)) issue({ code: "duplicate-id", message: `Duplicate circle id ${level.id}.` });
    if (orders.has(level.orderFromBottom)) {
      issue({ code: "duplicate-order", message: `Duplicate order ${level.orderFromBottom}.` });
    }
    ids.add(level.id);
    orders.add(level.orderFromBottom);

    if (level.id !== CIRCLE_IDS[arrayIndex] || level.orderFromBottom !== arrayIndex) {
      issue({ code: "level-order", message: `Circle ${level.id} is not in bottom-to-top position ${arrayIndex}.` });
    }
    if (level.actIndex !== Math.floor(arrayIndex / 3)) {
      issue({ code: "level-order", message: `Circle ${level.id} has an invalid act index.` });
    }
    if (level.rows.length !== LEVEL_ROWS) {
      issue({ code: "dimensions", message: `Expected ${LEVEL_ROWS} rows, received ${level.rows.length}.` });
    }

    level.rows.forEach((row, rowIndex) => {
      if (row.length !== LEVEL_COLUMNS) {
        issue({ code: "dimensions", message: `Row ${rowIndex} must contain ${LEVEL_COLUMNS} columns.`, row: rowIndex });
      }
      [...row].forEach((symbol, column) => {
        if (!(symbol in LEVEL_SYMBOLS)) {
          issue({ code: "unknown-symbol", message: `Unknown symbol ${JSON.stringify(symbol)}.`, row: rowIndex, column });
        }
      });
    });

    const starts = countSymbol(level, "S");
    const exits = countSymbol(level, "X");
    if (starts !== 1 || exits !== 1) {
      issue({ code: "marker-count", message: `Expected one S and one X, received S=${starts}, X=${exits}.` });
    }
    const startRow = level.rows.findIndex((row) => row.includes("S"));
    const exitRow = level.rows.findIndex((row) => row.includes("X"));
    if (startRow < 56 || exitRow < 0 || exitRow > 8) {
      issue({ code: "marker-position", message: `S must be near the floor and X near the ceiling (S=${startRow}, X=${exitRow}).` });
    }
    if (countSymbol(level, "P") !== 3) {
      issue({ code: "pickup-count", message: "Every circle must contain exactly three Voce fragments." });
    }
    const expectedCurve = LEVEL_CURVE[level.id];
    const actualCurve = {
      fragile: countFragilePlatforms(level),
      horizontal: countSymbol(level, "H"),
      vertical: countSymbol(level, "V"),
      enemies: countSymbol(level, "E") + countSymbol(level, "F"),
    };
    if (
      actualCurve.fragile !== expectedCurve.fragile ||
      actualCurve.horizontal !== expectedCurve.horizontal ||
      actualCurve.vertical !== expectedCurve.vertical ||
      actualCurve.enemies !== expectedCurve.enemies
    ) {
      issue({
        code: "difficulty-budget",
        message: `Expected C/H/V/enemies ${expectedCurve.fragile}/${expectedCurve.horizontal}/${expectedCurve.vertical}/${expectedCurve.enemies}, received ${actualCurve.fragile}/${actualCurve.horizontal}/${actualCurve.vertical}/${actualCurve.enemies}.`,
      });
    }
    if (level.checkpoint !== EXPECTED_CHECKPOINTS.has(arrayIndex)) {
      issue({ code: "checkpoint", message: `Unexpected checkpoint setting at position ${arrayIndex}.` });
    }
    if (level.boss !== EXPECTED_BOSSES.get(arrayIndex)) {
      issue({ code: "boss", message: `Unexpected boss setting at position ${arrayIndex}.` });
    }

    if (level.route.length < 2) {
      issue({ code: "route", message: "The critical route needs at least two platforms." });
    }
    level.route.forEach((node, routeIndex) => {
      const symbol = level.rows[node.row]?.[node.column] as LevelSymbol | undefined;
      if (!symbol || !PLATFORM_SYMBOLS.has(symbol)) {
        issue({ code: "route", message: `Route node ${routeIndex} is not supported by a platform.`, row: node.row, column: node.column });
      }
      const previous = level.route[routeIndex - 1];
      if (previous) {
        const rise = previous.row - node.row;
        const horizontalGap = Math.abs(previous.column - node.column);
        if (rise < 1 || rise > 5 || horizontalGap > 6) {
          issue({
            code: "route",
            message: `Route jump ${routeIndex - 1}->${routeIndex} exceeds geometry (rise=${rise}, gap=${horizontalGap}).`,
            row: node.row,
            column: node.column,
          });
        }
      }
    });

    const previousLevel = levels[arrayIndex - 1];
    if (previousLevel) {
      const previousExitColumn = previousLevel.rows.find((row) => row.includes("X"))?.indexOf("X") ?? -1;
      const entryColumn = level.rows.find((row) => row.includes("S"))?.indexOf("S") ?? -1;
      const entryGap = level.rows[LEVEL_ROWS - 1]?.slice(entryColumn - 2, entryColumn + 3);
      const entryNode = level.route[0];
      const entrySurface = entryNode ? level.rows[entryNode.row]?.[entryNode.column] : undefined;

      if (
        previousExitColumn < 0 ||
        entryColumn < 0 ||
        Math.abs(previousExitColumn - entryColumn) > 1 ||
        entryGap !== "     " ||
        entrySurface !== "-"
      ) {
        issue({ code: "route", message: `The seam from ${previousLevel.id} to ${level.id} is not traversable.` });
      }
    }
  });

  return Object.freeze(issues);
}

export function assertValidCircleLevels(levels: readonly CircleLevelDefinition[] = CIRCLE_LEVELS) {
  const issues = validateCircleLevels(levels);
  if (issues.length > 0) {
    throw new Error(`Invalid Cantica Zero level data:\n${issues.map((issue) => `- ${issue.levelId ?? "world"}: ${issue.message}`).join("\n")}`);
  }
}
