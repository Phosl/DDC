import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import sharp from "sharp";

export const ATLAS_GRID = Object.freeze({ columns: 6, rows: 4 });
export const RUNTIME_CELL = 64;
export const RUNTIME_SIZE = Object.freeze({
  width: ATLAS_GRID.columns * RUNTIME_CELL,
  height: ATLAS_GRID.rows * RUNTIME_CELL,
});

const DEFAULT_OPTIONS = Object.freeze({
  anchorX: 0.5,
  alphaThreshold: 8,
  chroma: "auto",
  footline: 58,
  gutter: 2,
  maxBottomJitter: null,
  maxCenterJitter: null,
  maxGreenSpill: 0.01,
  normalize: false,
  normalizationScale: "per-cell",
  registration: "bounds",
  sourceLayout: "grid",
  runtimeCell: RUNTIME_CELL,
});

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function assertFiniteRange(name, value, minimum, maximum) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}.`);
  }
}

function resolveOptions(options = {}) {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  if (!Number.isInteger(resolved.runtimeCell) || resolved.runtimeCell < 1) {
    throw new Error("runtimeCell must be a positive integer.");
  }
  if (!Number.isInteger(resolved.gutter) || resolved.gutter < 0) {
    throw new Error("gutter must be a non-negative integer.");
  }
  if (!Number.isInteger(resolved.alphaThreshold)) {
    throw new Error("alphaThreshold must be an integer.");
  }
  assertFiniteRange("alphaThreshold", resolved.alphaThreshold, 0, 255);
  assertFiniteRange("anchorX", resolved.anchorX, 0, 1);
  assertFiniteRange("footline", resolved.footline, 0, resolved.runtimeCell - 1);
  assertFiniteRange("maxGreenSpill", resolved.maxGreenSpill, 0, 1);
  for (const [name, value] of [
    ["maxBottomJitter", resolved.maxBottomJitter],
    ["maxCenterJitter", resolved.maxCenterJitter],
  ]) {
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      throw new Error(`${name} must be a non-negative number or null.`);
    }
  }
  if (!["auto", "green", "off"].includes(resolved.chroma)) {
    throw new Error('chroma must be "auto", "green", or "off".');
  }
  if (!["per-cell", "sheet"].includes(resolved.normalizationScale)) {
    throw new Error('normalizationScale must be "per-cell" or "sheet".');
  }
  if (!["bounds", "source-cell"].includes(resolved.registration)) {
    throw new Error('registration must be "bounds" or "source-cell".');
  }
  if (!["grid", "components"].includes(resolved.sourceLayout)) {
    throw new Error('sourceLayout must be "grid" or "components".');
  }
  if (resolved.sourceLayout === "components" && resolved.chroma === "off") {
    throw new Error('sourceLayout "components" requires chroma auto or green.');
  }
  if (resolved.gutter * 2 >= resolved.runtimeCell) {
    throw new Error("gutter leaves no usable cell area.");
  }
  if (resolved.normalize && resolved.footline < resolved.gutter) {
    throw new Error("footline must be below the top gutter.");
  }
  if (
    resolved.normalize &&
    resolved.footline > resolved.runtimeCell - resolved.gutter - 1
  ) {
    throw new Error("footline must stay above the bottom gutter.");
  }
  return resolved;
}

export function assertExactGrid(width, height, source = "atlas") {
  if (
    width % ATLAS_GRID.columns !== 0 ||
    height % ATLAS_GRID.rows !== 0
  ) {
    throw new Error(`${source} is not an exact 6x4 grid.`);
  }

  const cellWidth = width / ATLAS_GRID.columns;
  const cellHeight = height / ATLAS_GRID.rows;
  if (cellWidth !== cellHeight) {
    throw new Error(
      `${source} has non-square cells (${cellWidth}x${cellHeight}); expected a 6x4 grid of square cells.`,
    );
  }
  return cellWidth;
}

function looksLikeGreenScreen(red, green, blue) {
  const dominance = green - Math.max(red, blue);
  const distance = Math.hypot(red - 28, green - 238, blue - 28);
  return green > 150 && dominance > 54 && distance < 154;
}

function detectGreenScreen(data, width, height, hasMeaningfulTransparency) {
  // Transparent artwork (especially VFX) may legitimately contain green light.
  // In auto mode its alpha is authoritative, so chroma removal stays disabled.
  if (hasMeaningfulTransparency) return false;

  let samples = 0;
  let greenSamples = 0;
  const stride = Math.max(1, Math.floor(Math.min(width, height) / 128));
  const sample = (x, y) => {
    const offset = (y * width + x) * 4;
    samples += 1;
    if (looksLikeGreenScreen(data[offset], data[offset + 1], data[offset + 2])) {
      greenSamples += 1;
    }
  };

  for (let x = 0; x < width; x += stride) {
    sample(x, 0);
    sample(x, height - 1);
  }
  for (let y = stride; y < height - stride; y += stride) {
    sample(0, y);
    sample(width - 1, y);
  }
  return samples > 0 && greenSamples / samples >= 0.55;
}

export function removeGreenScreen(data, width, height, options = {}) {
  const resolved = resolveOptions(options);
  const output = Buffer.from(data);
  const pixelCount = width * height;
  let transparentInputPixels = 0;

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    if (data[pixel * 4 + 3] < 250) transparentInputPixels += 1;
  }
  const meaningfulTransparency = transparentInputPixels / pixelCount >= 0.005;
  const chromaApplied =
    resolved.chroma === "green" ||
    (resolved.chroma === "auto" &&
      detectGreenScreen(data, width, height, meaningfulTransparency));

  let transparentPixels = 0;
  let softenedPixels = 0;
  let despilledPixels = 0;
  if (!chromaApplied) {
    return {
      data: output,
      stats: {
        chromaApplied,
        despilledPixels,
        softenedPixels,
        transparentInputPixels,
        transparentPixels,
      },
    };
  }

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const offset = pixel * 4;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const sourceAlpha = data[offset + 3];
    const dominance = green - Math.max(red, blue);
    const distance = Math.hypot(red - 28, green - 238, blue - 28);
    let matteAlpha = 255;

    if (green > 174 && dominance > 88 && distance < 116) {
      matteAlpha = 0;
      transparentPixels += 1;
    } else if (looksLikeGreenScreen(red, green, blue)) {
      matteAlpha = clamp(Math.round((distance - 100) * 4.6), 0, 255);
      softenedPixels += 1;
    }

    const outputAlpha = Math.round((sourceAlpha * matteAlpha) / 255);
    output[offset + 3] = outputAlpha;
    if (outputAlpha === 0) {
      output[offset] = 0;
      output[offset + 1] = 0;
      output[offset + 2] = 0;
      continue;
    }

    if (matteAlpha < 255) {
      const matteStrength = 1 - matteAlpha / 255;
      const neutralGreen = Math.max(red, blue);
      const despillStrength = clamp(0.35 + matteStrength * 0.65, 0, 1);
      output[offset + 1] = Math.round(
        green + (neutralGreen - green) * despillStrength,
      );
      despilledPixels += 1;
    } else if (
      green > 70 &&
      dominance > 28 &&
      red < 110 &&
      blue < 140
    ) {
      // Chroma-key edges can retain a dark green fringe that is too far from
      // the bright backdrop to enter the soft matte. Neutralize only this
      // screen-green signature; cyan, yellow and skin tones stay untouched.
      output[offset + 1] = Math.min(green, Math.max(red, blue) + 28);
      despilledPixels += 1;
    }
  }

  return {
    data: output,
    stats: {
      chromaApplied,
      despilledPixels,
      softenedPixels,
      transparentInputPixels,
      transparentPixels,
    },
  };
}

function cropRaw(data, imageWidth, left, top, width, height) {
  const output = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const sourceStart = ((top + row) * imageWidth + left) * 4;
    data.copy(output, row * width * 4, sourceStart, sourceStart + width * 4);
  }
  return output;
}

function findAlphaBounds(data, width, height, alphaThreshold) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] <= alphaThreshold) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) return null;
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

function findAlphaComponents(data, width, height, alphaThreshold) {
  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  const components = [];

  for (let start = 0; start < pixelCount; start += 1) {
    if (visited[start] || data[start * 4 + 3] <= alphaThreshold) continue;
    let head = 0;
    let tail = 0;
    let left = width;
    let top = height;
    let right = -1;
    let bottom = -1;
    let count = 0;
    queue[tail++] = start;
    visited[start] = 1;
    while (head < tail) {
      const pixel = queue[head++];
      const y = Math.floor(pixel / width);
      const x = pixel - y * width;
      count += 1;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) continue;
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
          const next = nextY * width + nextX;
          if (visited[next] || data[next * 4 + 3] <= alphaThreshold) continue;
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    if (count < 64) continue;
    components.push({
      left,
      top,
      width: right - left + 1,
      height: bottom - top + 1,
      centerX: (left + right) / 2,
      centerY: (top + bottom) / 2,
      count,
    });
  }

  components.sort((first, second) => first.centerY - second.centerY || first.centerX - second.centerX);
  if (components.length !== ATLAS_GRID.columns * ATLAS_GRID.rows) {
    throw new Error(
      `component source contains ${components.length} poses; expected exactly 24 connected poses.`,
    );
  }
  const rows = [];
  for (const component of components) {
    const row = rows.find(
      (candidate) => Math.abs(candidate.centerY - component.centerY) <= sourceCellHeight(height) * 0.38,
    );
    if (row) {
      row.items.push(component);
      row.centerY = row.items.reduce((sum, item) => sum + item.centerY, 0) / row.items.length;
    } else {
      rows.push({ centerY: component.centerY, items: [component] });
    }
  }
  rows.sort((first, second) => first.centerY - second.centerY);
  if (rows.length !== ATLAS_GRID.rows || rows.some((row) => row.items.length !== ATLAS_GRID.columns)) {
    throw new Error("component source must contain four visual rows with six poses each.");
  }
  return rows.flatMap((row) => row.items.sort((first, second) => first.centerX - second.centerX));
}

function sourceCellHeight(height) {
  return height / ATLAS_GRID.rows;
}

function copyRaw(source, sourceWidth, sourceHeight, target, targetWidth, left, top) {
  for (let y = 0; y < sourceHeight; y += 1) {
    const targetY = top + y;
    if (targetY < 0 || targetY >= target.length / 4 / targetWidth) continue;
    for (let x = 0; x < sourceWidth; x += 1) {
      const targetX = left + x;
      if (targetX < 0 || targetX >= targetWidth) continue;
      const sourceOffset = (y * sourceWidth + x) * 4;
      const targetOffset = (targetY * targetWidth + targetX) * 4;
      source.copy(target, targetOffset, sourceOffset, sourceOffset + 4);
    }
  }
}

async function normalizeCell(cell, sourceCell, options, bounds, commonScale = null) {
  const canvas = Buffer.alloc(options.runtimeCell * options.runtimeCell * 4);
  if (!bounds) return canvas;

  const content = cropRaw(
    cell,
    sourceCell,
    bounds.left,
    bounds.top,
    bounds.width,
    bounds.height,
  );
  const maxWidth = options.runtimeCell - options.gutter * 2;
  const maxHeight = options.footline - options.gutter + 1;
  const scale =
    commonScale ?? Math.min(maxWidth / bounds.width, maxHeight / bounds.height);
  const width = Math.max(1, Math.round(bounds.width * scale));
  const height = Math.max(1, Math.round(bounds.height * scale));
  const resized = await sharp(content, {
    raw: { width: bounds.width, height: bounds.height, channels: 4 },
  })
    .resize(width, height, { fit: "fill", kernel: sharp.kernel.nearest })
    .raw()
    .toBuffer();
  const anchor = Math.round(options.anchorX * (options.runtimeCell - 1));
  const left =
    options.registration === "source-cell"
      ? clamp(
          Math.round(
            anchor +
              (bounds.left - options.anchorX * sourceCell) * scale,
          ),
          options.gutter,
          options.runtimeCell - options.gutter - width,
        )
      : clamp(
          Math.round(anchor - options.anchorX * (width - 1)),
          options.gutter,
          options.runtimeCell - options.gutter - width,
        );
  const top =
    options.registration === "source-cell"
      ? clamp(
          Math.round(
            options.footline +
              (bounds.top -
                options.footline * (sourceCell / options.runtimeCell)) *
                scale,
          ),
          options.gutter,
          options.runtimeCell - options.gutter - height,
        )
      : options.footline - height + 1;
  copyRaw(resized, width, height, canvas, options.runtimeCell, left, top);
  return canvas;
}

async function resizeCell(cell, sourceCell, runtimeCell) {
  if (sourceCell === runtimeCell) return Buffer.from(cell);
  return sharp(cell, {
    raw: { width: sourceCell, height: sourceCell, channels: 4 },
  })
    .resize(runtimeCell, runtimeCell, {
      fit: "fill",
      kernel: sharp.kernel.nearest,
    })
    .raw()
    .toBuffer();
}

export function validateAtlasData(data, width, height, options = {}) {
  const resolved = resolveOptions(options);
  const errors = [];
  let cell;
  try {
    cell = assertExactGrid(width, height, "atlas");
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return { errors, metrics: null, valid: false };
  }

  if (options.requireRuntimeSize !== false) {
    const expectedWidth = ATLAS_GRID.columns * resolved.runtimeCell;
    const expectedHeight = ATLAS_GRID.rows * resolved.runtimeCell;
    if (width !== expectedWidth || height !== expectedHeight) {
      errors.push(
        `atlas is ${width}x${height}; expected ${expectedWidth}x${expectedHeight}.`,
      );
    }
  }

  let visiblePixels = 0;
  let greenSpillPixels = 0;
  let gutterPixels = 0;
  const cells = [];
  const centers = [];
  const bottoms = [];
  for (let row = 0; row < ATLAS_GRID.rows; row += 1) {
    for (let column = 0; column < ATLAS_GRID.columns; column += 1) {
      const cellData = cropRaw(
        data,
        width,
        column * cell,
        row * cell,
        cell,
        cell,
      );
      const bounds = findAlphaBounds(
        cellData,
        cell,
        cell,
        resolved.alphaThreshold,
      );
      let cellVisiblePixels = 0;
      let cellGreenSpillPixels = 0;
      let cellGutterPixels = 0;
      let edgePixels = 0;
      for (let y = 0; y < cell; y += 1) {
        for (let x = 0; x < cell; x += 1) {
          const offset = (y * cell + x) * 4;
          if (cellData[offset + 3] <= resolved.alphaThreshold) continue;
          cellVisiblePixels += 1;
          const red = cellData[offset];
          const green = cellData[offset + 1];
          const blue = cellData[offset + 2];
          if (green > 120 && green - Math.max(red, blue) > 40) {
            cellGreenSpillPixels += 1;
          }
          if (x === 0 || x === cell - 1 || y === 0 || y === cell - 1) {
            edgePixels += 1;
          }
          if (
            resolved.gutter > 0 &&
            (x < resolved.gutter ||
              x >= cell - resolved.gutter ||
              y < resolved.gutter ||
              y >= cell - resolved.gutter)
          ) {
            cellGutterPixels += 1;
          }
        }
      }
      const right = bounds ? bounds.left + bounds.width - 1 : null;
      const bottom = bounds ? bounds.top + bounds.height - 1 : null;
      const centerX = bounds && right !== null ? (bounds.left + right) / 2 : null;
      if (centerX !== null) centers.push(centerX);
      if (bottom !== null) bottoms.push(bottom);
      cells.push({
        index: row * ATLAS_GRID.columns + column,
        row,
        column,
        bounds: bounds
          ? {
              ...bounds,
              right,
              bottom,
            }
          : null,
        bottom,
        centerX,
        edgePixels,
        greenSpillPixels: cellGreenSpillPixels,
        gutterPixels: cellGutterPixels,
        visiblePixels: cellVisiblePixels,
      });
      visiblePixels += cellVisiblePixels;
      greenSpillPixels += cellGreenSpillPixels;
      gutterPixels += cellGutterPixels;
    }
  }

  const greenSpillRatio = visiblePixels > 0 ? greenSpillPixels / visiblePixels : 0;
  const centerJitter = centers.length > 0 ? Math.max(...centers) - Math.min(...centers) : 0;
  const bottomJitter = bottoms.length > 0 ? Math.max(...bottoms) - Math.min(...bottoms) : 0;
  if (greenSpillRatio > resolved.maxGreenSpill) {
    errors.push(
      `green spill ratio ${greenSpillRatio.toFixed(4)} exceeds ${resolved.maxGreenSpill.toFixed(4)}.`,
    );
  }
  if (gutterPixels > 0) {
    errors.push(
      `${gutterPixels} visible pixels intrude into the ${resolved.gutter}px cell gutter.`,
    );
  }
  if (
    resolved.maxCenterJitter !== null &&
    centerJitter > resolved.maxCenterJitter
  ) {
    errors.push(
      `center jitter ${centerJitter.toFixed(2)}px exceeds ${resolved.maxCenterJitter.toFixed(2)}px.`,
    );
  }
  if (
    resolved.maxBottomJitter !== null &&
    bottomJitter > resolved.maxBottomJitter
  ) {
    errors.push(
      `bottom jitter ${bottomJitter.toFixed(2)}px exceeds ${resolved.maxBottomJitter.toFixed(2)}px.`,
    );
  }

  return {
    errors,
    metrics: {
      alignment: {
        bottomJitter,
        bottomRange:
          bottoms.length > 0 ? [Math.min(...bottoms), Math.max(...bottoms)] : null,
        centerJitter,
        centerRange:
          centers.length > 0 ? [Math.min(...centers), Math.max(...centers)] : null,
        nonEmptyCells: centers.length,
      },
      cell,
      cells,
      greenSpillPixels,
      greenSpillRatio,
      gutterPixels,
      visiblePixels,
    },
    valid: errors.length === 0,
  };
}

export async function validateAtlasFile(source, options = {}) {
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  const result = validateAtlasData(data, info.width, info.height, options);
  return { ...result, source, size: `${info.width}x${info.height}` };
}

export async function processGameAtlas(source, destination, options = {}) {
  const resolved = resolveOptions(options);
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  const sourceCell = assertExactGrid(info.width, info.height, source);
  const chroma = removeGreenScreen(data, info.width, info.height, resolved);
  const targetWidth = ATLAS_GRID.columns * resolved.runtimeCell;
  const targetHeight = ATLAS_GRID.rows * resolved.runtimeCell;
  const output = Buffer.alloc(targetWidth * targetHeight * 4);
  const sourceCells = [];

  if (resolved.sourceLayout === "components") {
    const components = findAlphaComponents(
      chroma.data,
      info.width,
      info.height,
      resolved.alphaThreshold,
    );
    components.forEach((bounds, index) => {
      const data = cropRaw(
        chroma.data,
        info.width,
        bounds.left,
        bounds.top,
        bounds.width,
        bounds.height,
      );
      sourceCells.push({
        column: index % ATLAS_GRID.columns,
        data,
        row: Math.floor(index / ATLAS_GRID.columns),
        sourceCellWidth: bounds.width,
        sourceCellHeight: bounds.height,
        bounds: { left: 0, top: 0, width: bounds.width, height: bounds.height },
      });
    });
  } else {
    for (let row = 0; row < ATLAS_GRID.rows; row += 1) {
      for (let column = 0; column < ATLAS_GRID.columns; column += 1) {
        const data = cropRaw(
          chroma.data,
          info.width,
          column * sourceCell,
          row * sourceCell,
          sourceCell,
          sourceCell,
        );
        sourceCells.push({
          column,
          data,
          row,
          sourceCellWidth: sourceCell,
          sourceCellHeight: sourceCell,
          bounds: findAlphaBounds(
            data,
            sourceCell,
            sourceCell,
            resolved.alphaThreshold,
          ),
        });
      }
    }
  }

  let commonScale = null;
  if (resolved.normalize && resolved.normalizationScale === "sheet") {
    const bounds = sourceCells.flatMap((entry) =>
      entry.bounds ? [entry.bounds] : [],
    );
    if (bounds.length > 0) {
      const widest = Math.max(...bounds.map((entry) => entry.width));
      const tallest = Math.max(...bounds.map((entry) => entry.height));
      const maxWidth = resolved.runtimeCell - resolved.gutter * 2;
      const maxHeight = resolved.footline - resolved.gutter + 1;
      commonScale = Math.min(maxWidth / widest, maxHeight / tallest);
    }
  }

  for (const entry of sourceCells) {
      const cell = resolved.normalize
        ? await normalizeCell(
            entry.data,
            entry.sourceCellWidth,
            resolved,
            entry.bounds,
            commonScale,
          )
        : await resizeCell(entry.data, entry.sourceCellWidth, resolved.runtimeCell);
      copyRaw(
        cell,
        resolved.runtimeCell,
        resolved.runtimeCell,
        output,
        targetWidth,
        entry.column * resolved.runtimeCell,
        entry.row * resolved.runtimeCell,
      );
  }

  const validation = validateAtlasData(output, targetWidth, targetHeight, {
    ...resolved,
    gutter: resolved.normalize ? resolved.gutter : 0,
    // When alpha was already authoritative, vivid green may be intentional
    // artwork. Call the standalone validator with a stricter threshold when a
    // particular asset family forbids green.
    maxGreenSpill:
      !chroma.stats.chromaApplied && options.maxGreenSpill === undefined
        ? 1
        : resolved.maxGreenSpill,
  });
  if (!validation.valid) {
    throw new Error(`Atlas validation failed: ${validation.errors.join(" ")}`);
  }

  await mkdir(path.dirname(destination), { recursive: true });
  const temporaryDestination = path.join(
    path.dirname(destination),
    `.${path.basename(destination)}.${process.pid}.tmp.png`,
  );
  try {
    await sharp(output, {
      raw: { width: targetWidth, height: targetHeight, channels: 4 },
    })
      .png({ compressionLevel: 9, palette: false })
      .toFile(temporaryDestination);
    await rename(temporaryDestination, destination);
  } finally {
    await rm(temporaryDestination, { force: true });
  }

  return {
    source,
    destination,
    sourceSize: `${info.width}x${info.height}`,
    targetSize: `${targetWidth}x${targetHeight}`,
    normalized: resolved.normalize,
    normalizationScale: resolved.normalizationScale,
    ...chroma.stats,
    validation: validation.metrics,
  };
}

export async function insetTransparentAtlas(
  source,
  destination,
  options = {},
) {
  const resolved = resolveOptions({ ...options, chroma: "off" });
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  const sourceCell = assertExactGrid(info.width, info.height, source);
  const inset = resolved.gutter;
  const targetCell = resolved.runtimeCell;
  const contentSize = targetCell - inset * 2;
  const output = Buffer.alloc(
    ATLAS_GRID.columns * targetCell * ATLAS_GRID.rows * targetCell * 4,
  );
  const targetWidth = ATLAS_GRID.columns * targetCell;
  for (let row = 0; row < ATLAS_GRID.rows; row += 1) {
    for (let column = 0; column < ATLAS_GRID.columns; column += 1) {
      const cell = cropRaw(
        data,
        info.width,
        column * sourceCell,
        row * sourceCell,
        sourceCell,
        sourceCell,
      );
      const resized = await sharp(cell, {
        raw: { width: sourceCell, height: sourceCell, channels: 4 },
      })
        .resize(contentSize, contentSize, { kernel: sharp.kernel.nearest })
        .raw()
        .toBuffer();
      copyRaw(
        resized,
        contentSize,
        contentSize,
        output,
        targetWidth,
        column * targetCell + inset,
        row * targetCell + inset,
      );
    }
  }
  const validation = validateAtlasData(
    output,
    targetWidth,
    ATLAS_GRID.rows * targetCell,
    { ...resolved, maxGreenSpill: options.maxGreenSpill ?? 1 },
  );
  if (!validation.valid) {
    throw new Error(`Atlas validation failed: ${validation.errors.join(" ")}`);
  }
  await mkdir(path.dirname(destination), { recursive: true });
  const temporaryDestination = path.join(
    path.dirname(destination),
    `.${path.basename(destination)}.${process.pid}.tmp.png`,
  );
  try {
    await sharp(output, {
      raw: {
        width: targetWidth,
        height: ATLAS_GRID.rows * targetCell,
        channels: 4,
      },
    })
      .png({ compressionLevel: 9, palette: false })
      .toFile(temporaryDestination);
    await rename(temporaryDestination, destination);
  } finally {
    await rm(temporaryDestination, { force: true });
  }
  return { destination, source, validation: validation.metrics };
}

function parseCliArguments(argv) {
  const positional = [];
  const options = {};
  for (const argument of argv) {
    if (!argument.startsWith("--")) {
      positional.push(argument);
      continue;
    }
    const [name, rawValue] = argument.slice(2).split("=", 2);
    const value = rawValue ?? "true";
    if (name === "normalize") options.normalize = value !== "false";
    else if (name === "chroma") options.chroma = value;
    else if (name === "gutter") options.gutter = Number(value);
    else if (name === "anchor-x") options.anchorX = Number(value);
    else if (name === "footline") options.footline = Number(value);
    else if (name === "alpha-threshold") options.alphaThreshold = Number(value);
    else if (name === "max-green-spill") options.maxGreenSpill = Number(value);
    else if (name === "max-center-jitter") options.maxCenterJitter = Number(value);
    else if (name === "max-bottom-jitter") options.maxBottomJitter = Number(value);
    else if (name === "normalization-scale" || name === "scale") {
      options.normalizationScale = value;
    }
    else if (name === "registration") options.registration = value;
    else if (name === "source-layout") options.sourceLayout = value;
    else if (name === "cell") options.runtimeCell = Number(value);
    else throw new Error(`Unknown option --${name}.`);
  }
  return { positional, options };
}

async function main() {
  const { positional, options } = parseCliArguments(process.argv.slice(2));
  const [source, destination] = positional;
  if (!source || !destination || positional.length !== 2) {
    throw new Error(
      "Usage: node scripts/process-game-atlas.mjs <source> <destination> " +
        "[--chroma=auto|green|off] [--normalize] [--gutter=2] " +
        "[--anchor-x=0.5] [--footline=58] [--normalization-scale=per-cell|sheet] " +
        "[--registration=bounds|source-cell] " +
        "[--source-layout=grid|components] " +
        "[--cell=64] [--max-center-jitter=4] [--max-bottom-jitter=1]",
    );
  }
  const result = await processGameAtlas(source, destination, options);
  console.log(JSON.stringify(result, null, 2));
}

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
  : false;
if (isMain) await main();
