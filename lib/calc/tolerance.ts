/**
 * Parses the Dimensional Report's free-text "Design Spec." (Dim + Tol)
 * columns into a numeric nominal/upper/lower band, so a reading can be
 * auto-flagged OK/NG. Formats confirmed present in the real reference
 * sheet: plain numbers ("415"), a trailing Int/Ext tag ("1239 Int", "30
 * int", "2060 Ext" — case varies, preserved verbatim for display but
 * ignored for the math), degree values ("45°" with tolerance "±1°"), and
 * a newline-separated asymmetric tolerance ("+1\n-0"). Slash-separated
 * asymmetric ("+0.2/-0.1") and one-sided MIN/MAX tolerances are also
 * supported per spec, though absent from this particular sample.
 */

export type ParsedDimension = {
  nominal: number;
  tag: string | null;
  isAngle: boolean;
};

export type ParsedTolerance = {
  nominal: number;
  upper: number;
  lower: number;
  tag: string | null;
  isAngle: boolean;
};

export type ReadingStatus = "OK" | "NG" | "UNKNOWN";

const DIMENSION_PATTERN = /^(-?\d+(?:\.\d+)?)\s*(°)?\s*([A-Za-z]+)?\.?$/;

export function parseDesignDimension(text: string | null | undefined): ParsedDimension | null {
  if (!text) return null;
  const trimmed = text.trim();
  const match = DIMENSION_PATTERN.exec(trimmed);
  if (!match) return null;

  const nominal = Number(match[1]);
  if (!Number.isFinite(nominal)) return null;
  const degreeSuffix = Boolean(match[2]);
  const word = match[3] ?? null;

  // A bare MIN/MAX word in the dimension cell itself isn't a tag to
  // preserve — it belongs to the tolerance side of the parser.
  if (word && /^(min|max)$/i.test(word)) {
    return { nominal, tag: null, isAngle: degreeSuffix };
  }

  return { nominal, tag: word, isAngle: degreeSuffix };
}

const SYMMETRIC_PATTERN = /^[±]\s*(\d+(?:\.\d+)?)\s*°?$/;
const ASYMMETRIC_PATTERN = /^\+\s*(\d+(?:\.\d+)?)\s*[/\n]\s*-\s*(\d+(?:\.\d+)?)\s*°?$/;
const MIN_PATTERN = /^min\.?$/i;
const MAX_PATTERN = /^max\.?$/i;

export function parseTolerance(text: string | null | undefined, nominal: number): { upper: number; lower: number } | null {
  if (!text) return null;
  const trimmed = text.trim();

  if (MIN_PATTERN.test(trimmed)) return { upper: Infinity, lower: nominal };
  if (MAX_PATTERN.test(trimmed)) return { upper: nominal, lower: -Infinity };

  const symmetric = SYMMETRIC_PATTERN.exec(trimmed);
  if (symmetric) {
    const delta = Number(symmetric[1]);
    return { upper: nominal + delta, lower: nominal - delta };
  }

  const asymmetric = ASYMMETRIC_PATTERN.exec(trimmed);
  if (asymmetric) {
    const upperDelta = Number(asymmetric[1]);
    const lowerDelta = Number(asymmetric[2]);
    return { upper: nominal + upperDelta, lower: nominal - lowerDelta };
  }

  return null;
}

export function parseDimensionAndTolerance(
  dimensionText: string | null | undefined,
  toleranceText: string | null | undefined,
): ParsedTolerance | null {
  const dim = parseDesignDimension(dimensionText);
  if (!dim) return null;
  const band = parseTolerance(toleranceText, dim.nominal);
  if (!band) return null;
  return { nominal: dim.nominal, upper: band.upper, lower: band.lower, tag: dim.tag, isAngle: dim.isAngle };
}

export function computeStatus(value: number | null | undefined, parsed: ParsedTolerance | null): ReadingStatus {
  if (value === null || value === undefined || !Number.isFinite(value) || !parsed) return "UNKNOWN";
  return value >= parsed.lower && value <= parsed.upper ? "OK" : "NG";
}

const COMBINED_NOMINAL_PATTERN = /^[øØ⌀]?\s*(-?\d+(?:\.\d+)?)\s*(.*)$/;

/**
 * Best-effort parser for a single free-text "spec" field that combines
 * dimension and tolerance in one string (e.g. Control Plan's "Product /
 * Process Specification" column — "76 +0/-0.355", "45 ±1°") rather than
 * the two separate Dim/Tol columns most other pages use. Splits off the
 * leading number as the nominal and re-parses the remainder with
 * parseTolerance; returns null (not a guess) when the remainder isn't one
 * of the tolerance patterns above, which is expected for most real Control
 * Plan specs ("As per drawing", "Free from rust") that carry no number.
 */
export function parseCombinedSpec(text: string | null | undefined): ParsedTolerance | null {
  if (!text) return null;
  const match = COMBINED_NOMINAL_PATTERN.exec(text.trim());
  if (!match) return null;
  const nominal = Number(match[1]);
  if (!Number.isFinite(nominal)) return null;
  const rest = match[2].trim();
  const band = parseTolerance(rest, nominal);
  if (!band) return null;
  const isAngle = /°/.test(rest);
  return { nominal, upper: band.upper, lower: band.lower, tag: null, isAngle };
}

const RANGE_TEXT_PATTERN = /(-?\d+(?:\.\d+)?)\s*(?:[A-Za-z°]+)?\s*(?:to|-|–)\s*(-?\d+(?:\.\d+)?)/i;

/**
 * Best-effort parser for a "min to max" range buried in otherwise free
 * text (element 12's Paint requirement, copied from a Control Plan row
 * like "80 GU to 90 GU" — see lib/actions/lab.ts). Returns null for
 * qualitative specs ("Ref. DMS296", "No peel off") rather than guessing.
 */
export function parseRangeText(text: string | null | undefined): { min: number; max: number } | null {
  if (!text) return null;
  const match = RANGE_TEXT_PATTERN.exec(text.trim());
  if (!match) return null;
  const a = Number(match[1]);
  const b = Number(match[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return { min: Math.min(a, b), max: Math.max(a, b) };
}
