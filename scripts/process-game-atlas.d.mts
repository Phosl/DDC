export type ChromaMode = "auto" | "green" | "off";

export type AtlasPipelineOptions = {
  anchorX?: number;
  alphaThreshold?: number;
  chroma?: ChromaMode;
  footline?: number;
  gutter?: number;
  maxBottomJitter?: number | null;
  maxCenterJitter?: number | null;
  maxGreenSpill?: number;
  normalize?: boolean;
  normalizationScale?: "per-cell" | "sheet";
  registration?: "bounds" | "source-cell";
  sourceLayout?: "grid" | "components";
  requireRuntimeSize?: boolean;
  runtimeCell?: number;
};

export type AtlasValidationMetrics = {
  alignment: {
    bottomJitter: number;
    bottomRange: [number, number] | null;
    centerJitter: number;
    centerRange: [number, number] | null;
    nonEmptyCells: number;
  };
  cell: number;
  cells: Array<{
    index: number;
    row: number;
    column: number;
    bounds: {
      left: number;
      top: number;
      right: number;
      bottom: number;
      width: number;
      height: number;
    } | null;
    bottom: number | null;
    centerX: number | null;
    edgePixels: number;
    greenSpillPixels: number;
    gutterPixels: number;
    visiblePixels: number;
  }>;
  greenSpillPixels: number;
  greenSpillRatio: number;
  gutterPixels: number;
  visiblePixels: number;
};

export type AtlasValidation = {
  errors: string[];
  metrics: AtlasValidationMetrics | null;
  valid: boolean;
};

export const ATLAS_GRID: Readonly<{ columns: 6; rows: 4 }>;
export const RUNTIME_CELL: 64;
export const RUNTIME_SIZE: Readonly<{ width: 384; height: 256 }>;

export function assertExactGrid(
  width: number,
  height: number,
  source?: string,
): number;

export function removeGreenScreen(
  data: Buffer,
  width: number,
  height: number,
  options?: AtlasPipelineOptions,
): {
  data: Buffer;
  stats: {
    chromaApplied: boolean;
    despilledPixels: number;
    softenedPixels: number;
    transparentInputPixels: number;
    transparentPixels: number;
  };
};

export function validateAtlasData(
  data: Buffer,
  width: number,
  height: number,
  options?: AtlasPipelineOptions,
): AtlasValidation;

export function validateAtlasFile(
  source: string,
  options?: AtlasPipelineOptions,
): Promise<
  AtlasValidation & {
    source: string;
    size: string;
  }
>;

export function processGameAtlas(
  source: string,
  destination: string,
  options?: AtlasPipelineOptions,
): Promise<{
  chromaApplied: boolean;
  despilledPixels: number;
  destination: string;
  normalized: boolean;
  normalizationScale: "per-cell" | "sheet";
  softenedPixels: number;
  source: string;
  sourceSize: string;
  targetSize: string;
  transparentInputPixels: number;
  transparentPixels: number;
  validation: AtlasValidationMetrics | null;
}>;

export function insetTransparentAtlas(
  source: string,
  destination: string,
  options?: AtlasPipelineOptions,
): Promise<{
  destination: string;
  source: string;
  validation: AtlasValidationMetrics | null;
}>;
