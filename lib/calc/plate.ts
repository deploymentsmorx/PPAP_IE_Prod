/**
 * Parses the Element 10 (RM Test Reports) "Required Size as per PO" /
 * "Observed material Size" columns — free text like "10X2000X6300"
 * (Thickness x Width x Length, mm) — and flags an observed size outside a
 * configurable PO tolerance. Real sheet sample (element 10, part 1170750):
 * thickness deviations run 0.05-0.2mm, width/length deviations run
 * 0-25mm (raw plate is deliberately cut oversize as machining stock), so
 * the default tolerances below are set to pass that sample cleanly while
 * still catching a materially-thin/thick plate.
 */

export type PlateSize = {
  thickness: number;
  width: number;
  length: number;
};

export type PlateTolerance = {
  thicknessMm: number;
  widthMm: number;
  lengthMm: number;
};

export const DEFAULT_PLATE_TOLERANCE: PlateTolerance = {
  thicknessMm: 0.3,
  widthMm: 30,
  lengthMm: 30,
};

export type PlateDimension = "thickness" | "width" | "length";

export type PlateFlagResult = {
  required: PlateSize | null;
  observed: PlateSize | null;
  deltas: Partial<Record<PlateDimension, number>>;
  flaggedDims: PlateDimension[];
  flagged: boolean;
};

const PLATE_SIZE_PATTERN = /^(-?\d+(?:\.\d+)?)\s*[xX]\s*(-?\d+(?:\.\d+)?)\s*[xX]\s*(-?\d+(?:\.\d+)?)$/;

export function parsePlateSize(text: string | null | undefined): PlateSize | null {
  if (!text) return null;
  const match = PLATE_SIZE_PATTERN.exec(text.trim());
  if (!match) return null;

  const thickness = Number(match[1]);
  const width = Number(match[2]);
  const length = Number(match[3]);
  if (![thickness, width, length].every(Number.isFinite)) return null;

  return { thickness, width, length };
}

export function computePlateFlags(
  requiredText: string | null | undefined,
  observedText: string | null | undefined,
  tolerance: PlateTolerance = DEFAULT_PLATE_TOLERANCE,
): PlateFlagResult {
  const required = parsePlateSize(requiredText);
  const observed = parsePlateSize(observedText);

  if (!required || !observed) {
    return { required, observed, deltas: {}, flaggedDims: [], flagged: false };
  }

  const deltas: Partial<Record<PlateDimension, number>> = {
    thickness: observed.thickness - required.thickness,
    width: observed.width - required.width,
    length: observed.length - required.length,
  };

  const limits: Record<PlateDimension, number> = {
    thickness: tolerance.thicknessMm,
    width: tolerance.widthMm,
    length: tolerance.lengthMm,
  };

  const flaggedDims = (Object.keys(deltas) as PlateDimension[]).filter(
    (dim) => Math.abs(deltas[dim]!) > limits[dim],
  );

  return { required, observed, deltas, flaggedDims, flagged: flaggedDims.length > 0 };
}
