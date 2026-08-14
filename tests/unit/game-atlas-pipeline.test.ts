import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  insetTransparentAtlas,
  processGameAtlas,
  removeGreenScreen,
  validateAtlasData,
  validateAtlasFile,
} from "../../scripts/process-game-atlas.mjs";

const WIDTH = 384;
const HEIGHT = 256;

async function temporaryPath(name: string) {
  const directory = await mkdtemp(path.join(tmpdir(), "ddc-atlas-"));
  return path.join(directory, name);
}

function solidAtlas(red: number, green: number, blue: number, alpha = 255) {
  const data = Buffer.alloc(WIDTH * HEIGHT * 4);
  for (let pixel = 0; pixel < WIDTH * HEIGHT; pixel += 1) {
    data.set([red, green, blue, alpha], pixel * 4);
  }
  return data;
}

async function writeRawPng(file: string, data: Buffer) {
  await sharp(data, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } })
    .png()
    .toFile(file);
}

async function rawPixels(file: string) {
  return sharp(file).ensureAlpha().raw().toBuffer();
}

describe("game atlas pipeline", () => {
  it("preserves authoritative alpha and legitimate green in transparent art", async () => {
    const source = await temporaryPath("transparent-vfx.png");
    const destination = await temporaryPath("processed-vfx.png");
    const data = solidAtlas(0, 255, 0, 0);
    const offset = (20 * WIDTH + 20) * 4;
    data.set([15, 240, 80, 180], offset);
    await writeRawPng(source, data);

    const result = await processGameAtlas(source, destination);
    const output = await rawPixels(destination);

    expect(result.chromaApplied).toBe(false);
    expect([...output.subarray(offset, offset + 4)]).toEqual([15, 240, 80, 180]);
  });

  it("adds a safe gutter to transparent VFX without chroma keying", async () => {
    const source = await temporaryPath("vfx-source.png");
    const destination = await temporaryPath("vfx-inset.png");
    const data = solidAtlas(0, 0, 0, 0);
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 6; column += 1) {
        for (let y = row * 64; y < row * 64 + 64; y += 1) {
          for (let x = column * 64; x < column * 64 + 64; x += 1) {
            if (x % 63 === 0 || y % 63 === 0) {
              data.set([15, 240, 80, 180], (y * WIDTH + x) * 4);
            }
          }
        }
      }
    }
    await writeRawPng(source, data);

    await insetTransparentAtlas(source, destination, {
      gutter: 3,
      maxGreenSpill: 1,
    });
    const report = await validateAtlasFile(destination, {
      gutter: 3,
      maxGreenSpill: 1,
    });

    expect(report.valid).toBe(true);
    expect(report.metrics?.gutterPixels).toBe(0);
  });

  it("keys an opaque green screen and despills its semi-green edge", async () => {
    const source = await temporaryPath("green-source.png");
    const destination = await temporaryPath("green-output.png");
    const data = solidAtlas(20, 238, 20);
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 6; column += 1) {
        const originX = column * 64;
        const originY = row * 64;
        for (let y = originY + 20; y < originY + 44; y += 1) {
          for (let x = originX + 20; x < originX + 44; x += 1) {
            data.set([220, 40, 80, 255], (y * WIDTH + x) * 4);
          }
        }
        data.set([70, 190, 70, 255], ((originY + 20) * WIDTH + originX + 19) * 4);
      }
    }
    await writeRawPng(source, data);

    const result = await processGameAtlas(source, destination, { chroma: "green" });
    const output = await rawPixels(destination);
    const background = 0;
    const edge = (20 * WIDTH + 19) * 4;

    expect(result.chromaApplied).toBe(true);
    expect(output[background + 3]).toBe(0);
    expect(output[edge + 3]).toBeLessThan(255);
    expect(output[edge + 1]).toBeLessThan(190);
  });

  it("neutralizes dark chroma fringes without erasing cyan artwork", () => {
    const data = Buffer.from([
      3, 120, 4, 255,
      10, 205, 220, 255,
    ]);

    const result = removeGreenScreen(data, 2, 1, { chroma: "green" });

    expect(result.data[1]).toBeLessThanOrEqual(32);
    expect([...result.data.subarray(4, 8)]).toEqual([10, 205, 220, 255]);
  });

  it("rejects grids whose 6x4 cells are not square", async () => {
    const source = await temporaryPath("bad-grid.png");
    const destination = await temporaryPath("unused.png");
    await sharp({
      create: { width: 600, height: 480, channels: 4, background: "transparent" },
    })
      .png()
      .toFile(source);

    await expect(processGameAtlas(source, destination)).rejects.toThrow(
      /non-square cells/,
    );
  });

  it("normalizes every frame to a configurable anchor, footline, and gutter", async () => {
    const source = await temporaryPath("unnormalized.png");
    const destination = await temporaryPath("normalized.png");
    const data = solidAtlas(0, 0, 0, 0);
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 6; column += 1) {
        for (let y = row * 64 + 2; y < row * 64 + 12; y += 1) {
          for (let x = column * 64 + 2; x < column * 64 + 12; x += 1) {
            data.set([220, 40, 80, 255], (y * WIDTH + x) * 4);
          }
        }
      }
    }
    await writeRawPng(source, data);

    await processGameAtlas(source, destination, {
      anchorX: 0.5,
      footline: 58,
      gutter: 3,
      normalize: true,
    });
    const validation = await validateAtlasFile(destination, { gutter: 3 });
    const output = await rawPixels(destination);

    expect(validation.valid).toBe(true);
    expect(output[(58 * WIDTH + 32) * 4 + 3]).toBe(255);
    expect(output[(59 * WIDTH + 32) * 4 + 3]).toBe(0);
  });

  it("reports per-cell bounds, edge counts, and alignment jitter", () => {
    const data = solidAtlas(0, 0, 0, 0);
    for (let y = 20; y < 30; y += 1) {
      for (let x = 10; x < 20; x += 1) {
        data.set([220, 40, 80, 255], (y * WIDTH + x) * 4);
      }
    }
    for (let y = 24; y < 34; y += 1) {
      for (let x = 64 + 14; x < 64 + 24; x += 1) {
        data.set([220, 40, 80, 255], (y * WIDTH + x) * 4);
      }
    }

    const report = validateAtlasData(data, WIDTH, HEIGHT, {
      gutter: 0,
      maxBottomJitter: 2,
      maxCenterJitter: 2,
    });

    expect(report.metrics?.cells[0].bounds).toEqual({
      bottom: 29,
      height: 10,
      left: 10,
      right: 19,
      top: 20,
      width: 10,
    });
    expect(report.metrics?.cells[0].edgePixels).toBe(0);
    expect(report.metrics?.alignment).toMatchObject({
      bottomJitter: 4,
      centerJitter: 4,
      nonEmptyCells: 2,
    });
    expect(report.errors.join(" ")).toMatch(/center jitter/);
    expect(report.errors.join(" ")).toMatch(/bottom jitter/);
  });

  it("uses one common sheet scale while aligning different poses", async () => {
    const source = await temporaryPath("family-source.png");
    const destination = await temporaryPath("family-normalized.png");
    const data = solidAtlas(0, 0, 0, 0);
    for (let y = 4; y < 14; y += 1) {
      for (let x = 4; x < 14; x += 1) {
        data.set([220, 40, 80, 255], (y * WIDTH + x) * 4);
      }
    }
    for (let y = 4; y < 24; y += 1) {
      for (let x = 64 + 4; x < 64 + 24; x += 1) {
        data.set([220, 40, 80, 255], (y * WIDTH + x) * 4);
      }
    }
    await writeRawPng(source, data);

    await processGameAtlas(source, destination, {
      footline: 58,
      gutter: 3,
      normalizationScale: "sheet",
      normalize: true,
    });
    const report = await validateAtlasFile(destination, { gutter: 3 });
    const small = report.metrics?.cells[0];
    const large = report.metrics?.cells[1];

    expect(report.valid).toBe(true);
    expect(small?.bounds?.width).toBe(28);
    expect(large?.bounds?.width).toBe(56);
    expect(small?.bottom).toBe(58);
    expect(large?.bottom).toBe(58);
    expect(small?.centerX).toBe(large?.centerX);
  });

  it("recovers a visually spaced 6 by 4 pose sheet before normalization", async () => {
    const source = await temporaryPath("component-source.png");
    const destination = await temporaryPath("component-normalized.png");
    const sourceWidth = 1536;
    const sourceHeight = 1024;
    const data = Buffer.alloc(sourceWidth * sourceHeight * 4);
    for (let pixel = 0; pixel < sourceWidth * sourceHeight; pixel += 1) {
      data.set([0, 255, 0, 255], pixel * 4);
    }
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 6; column += 1) {
        const centerX = 120 + column * 252 + (row % 2) * 18;
        const centerY = 110 + row * 250;
        const width = 70 + ((row + column) % 3) * 10;
        const height = 120 + (column % 2) * 18;
        for (let y = centerY - Math.floor(height / 2); y < centerY + Math.ceil(height / 2); y += 1) {
          for (let x = centerX - Math.floor(width / 2); x < centerX + Math.ceil(width / 2); x += 1) {
            data.set([220, 40, 80, 255], (y * sourceWidth + x) * 4);
          }
        }
      }
    }
    await sharp(data, {
      raw: { width: sourceWidth, height: sourceHeight, channels: 4 },
    }).png().toFile(source);

    await processGameAtlas(source, destination, {
      chroma: "green",
      footline: 58,
      gutter: 3,
      maxBottomJitter: 0,
      maxCenterJitter: 1,
      normalize: true,
      normalizationScale: "sheet",
      sourceLayout: "components",
    });
    const report = await validateAtlasFile(destination, {
      gutter: 3,
      maxBottomJitter: 0,
      maxCenterJitter: 1,
    });

    expect(report.valid).toBe(true);
    expect(report.metrics?.alignment.nonEmptyCells).toBe(24);
    expect(report.metrics?.alignment.centerJitter).toBeLessThanOrEqual(1);
    expect(report.metrics?.alignment.bottomJitter).toBe(0);
  });

  it("is pixel-idempotent when processing an already normalized atlas", async () => {
    const source = await temporaryPath("first.png");
    const second = await temporaryPath("second.png");
    const third = await temporaryPath("third.png");
    const data = solidAtlas(0, 0, 0, 0);
    data.set([200, 40, 100, 220], (12 * WIDTH + 12) * 4);
    await writeRawPng(source, data);

    await processGameAtlas(source, second, { chroma: "off" });
    await processGameAtlas(second, third, { chroma: "auto" });

    expect(await rawPixels(third)).toEqual(await rawPixels(second));
    expect((await readFile(third)).length).toBeGreaterThan(0);
  });

  it("reports green spill and visible cell-edge pixels", () => {
    const data = solidAtlas(0, 0, 0, 0);
    data.set([10, 220, 10, 255], 0);
    const result = validateAtlasData(data, WIDTH, HEIGHT, {
      gutter: 1,
      maxGreenSpill: 0,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/green spill/);
    expect(result.errors.join(" ")).toMatch(/gutter/);
  });
});
