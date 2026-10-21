/**
 * Element 12 (Lab Reports) calculations: lab-accreditation expiry (mirrors
 * lib/calc/calibration.ts's due-date convention — "never accredited" is
 * treated the same as expired, since there's nothing to confirm validity)
 * and the numeric OK/NG status shared by the Mechanical, Chemical and
 * Paint result tables.
 */

import { parseRangeText } from "@/lib/calc/tolerance";

export function isLabExpired(validUntil: Date | null, today: Date = new Date()): boolean {
  if (!validUntil) return true;
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return validUntil < startOfToday;
}

/** Only a non-expired lab is pickable for a new report. */
export function isLabPickable(validUntil: Date | null, today: Date = new Date()): boolean {
  return !isLabExpired(validUntil, today);
}

export type NumericStatus = "OK" | "NG" | "UNKNOWN";

/**
 * Shared by the Mechanical/Chemical/Paint tables: UNKNOWN when there's no
 * result yet, or no requirement to judge it against (e.g. Hardness's
 * free-text note, or a result typed before a material spec is picked).
 */
export function computeNumericStatus(result: number | null | undefined, min: number | null, max: number | null): NumericStatus {
  if (result === null || result === undefined || !Number.isFinite(result)) return "UNKNOWN";
  if (min === null && max === null) return "UNKNOWN";
  if (min !== null && result < min) return "NG";
  if (max !== null && result > max) return "NG";
  return "OK";
}

const MAX_LIMIT_PATTERN = /(?:\bmax\.?|\bmaximum\b|≤|<=)\s*(-?\d+(?:\.\d+)?)/i;
const MIN_LIMIT_PATTERN = /(?:\bmin\.?|\bminimum\b|≥|>=)\s*(-?\d+(?:\.\d+)?)/i;

/**
 * Best-effort numeric limits from a free-text requirement such as
 * MaterialSpec.hardnessNote: "120-160 HB" / "120 to 160 HV", "Max 160 HB",
 * "≥ 120 HV", or both bounds stated separately ("Min 120, Max 160").
 * Returns null for qualitative text ("As per drawing") rather than guessing,
 * so that row keeps the manual "—" status.
 */
export function parseLimitText(text: string | null | undefined): { min: number | null; max: number | null } | null {
  if (!text) return null;
  const range = parseRangeText(text);
  if (range) return range;
  const max = MAX_LIMIT_PATTERN.exec(text);
  const min = MIN_LIMIT_PATTERN.exec(text);
  if (!max && !min) return null;
  return { min: min ? Number(min[1]) : null, max: max ? Number(max[1]) : null };
}

/**
 * Display form of a Mechanical/Chemical requirement: free text wins (e.g.
 * Hardness's note), else "min-max", "Min x", "Max x", or "-".
 */
export function formatRequirement(min: number | null, max: number | null, text: string | null): string {
  if (text) return text;
  if (min !== null && max !== null) return `${min}-${max}`;
  if (min !== null) return `Min ${min}`;
  if (max !== null) return `Max ${max}`;
  return "-";
}
