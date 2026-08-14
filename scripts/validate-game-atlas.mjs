import path from "node:path";
import { pathToFileURL } from "node:url";

import { validateAtlasFile } from "./process-game-atlas.mjs";

function parseOptions(argv) {
  const [source, ...flags] = argv;
  const options = {};
  for (const flag of flags) {
    const [name, rawValue] = flag.replace(/^--/, "").split("=", 2);
    const value = rawValue ?? "true";
    if (name === "cell") options.runtimeCell = Number(value);
    else if (name === "gutter") options.gutter = Number(value);
    else if (name === "alpha-threshold") options.alphaThreshold = Number(value);
    else if (name === "max-green-spill") options.maxGreenSpill = Number(value);
    else if (name === "max-center-jitter") options.maxCenterJitter = Number(value);
    else if (name === "max-bottom-jitter") options.maxBottomJitter = Number(value);
    else throw new Error(`Unknown option --${name}.`);
  }
  return { options, source };
}

async function main() {
  const { source, options } = parseOptions(process.argv.slice(2));
  if (!source) {
    throw new Error(
      "Usage: node scripts/validate-game-atlas.mjs <atlas> " +
        "[--cell=64] [--gutter=2] [--max-green-spill=0.01] " +
        "[--max-center-jitter=4] [--max-bottom-jitter=1]",
    );
  }
  const result = await validateAtlasFile(source, options);
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) process.exitCode = 1;
}

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
  : false;
if (isMain) await main();
