/**
 * Checking Aids (element 16) calibration rules — see CLAUDE.md:
 *  - due = calibrated on + frequency (months), unless overridden;
 *  - status is computed, never stored: NOT_CALIBRATED (no due date),
 *    OVERDUE (due date already past), DUE_SOON (due within the window,
 *    default 15 days — the sheet's "Due is near"), else VALID.
 * Dates are compared on the UTC calendar (they're stored as UTC midnight).
 */

export type CalibrationStatus = "VALID" | "DUE_SOON" | "OVERDUE" | "NOT_CALIBRATED";

export const DEFAULT_DUE_SOON_DAYS = 15;

function utcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Whole days from today until the due date; negative once past. */
export function daysUntilDue(dueDate: Date, today: Date = new Date()): number {
  return Math.round((utcDay(dueDate) - utcDay(today)) / 86_400_000);
}

export function calibrationStatus(
  dueDate: Date | null,
  today: Date = new Date(),
  dueSoonDays: number = DEFAULT_DUE_SOON_DAYS,
): CalibrationStatus {
  if (!dueDate) return "NOT_CALIBRATED";
  const days = daysUntilDue(dueDate, today);
  if (days < 0) return "OVERDUE";
  if (days < dueSoonDays) return "DUE_SOON";
  return "VALID";
}

/**
 * Only a currently-calibrated instrument can be picked: OVERDUE and
 * NOT_CALIBRATED are rejected; DUE_SOON is still allowed (it's valid until
 * the due date).
 */
export function isInstrumentPickable(dueDate: Date | null, today: Date = new Date()): boolean {
  const status = calibrationStatus(dueDate, today);
  return status === "VALID" || status === "DUE_SOON";
}

/** calibratedOn + months on the UTC calendar; 31-Jan + 1 month → 28/29-Feb. */
export function computeCalibrationDue(calibratedOn: Date | null, frequencyMonths: number | null): Date | null {
  if (!calibratedOn || frequencyMonths == null) return null;
  const total = calibratedOn.getUTCMonth() + frequencyMonths;
  const y = calibratedOn.getUTCFullYear() + Math.floor(total / 12);
  const m = ((total % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(calibratedOn.getUTCDate(), lastDay)));
}

/** Sheet "CALIBRATION FREQUENCY" cell: "1 Year" / "1 YEAR" → 12, "6 Months" → 6, 12 → 12. */
export function parseFrequencyMonths(text: string | number | null | undefined): number | null {
  if (text == null) return null;
  if (typeof text === "number") return Number.isFinite(text) ? Math.trunc(text) : null;
  const m = /^\s*(\d+)\s*([a-z]*)\s*$/i.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit.startsWith("y")) return n * 12;
  if (unit === "" || unit.startsWith("m")) return n;
  return null;
}

/** Months → the sheet's wording: 12 → "1 Year", 24 → "2 Years", 6 → "6 Months". */
export function formatFrequencyMonths(months: number | null): string {
  if (months == null) return "-";
  if (months > 0 && months % 12 === 0) return `${months / 12} Year${months === 12 ? "" : "s"}`;
  return `${months} Month${months === 1 ? "" : "s"}`;
}

/**
 * Sheet date cells come three ways: a real date, an Excel serial (45812 →
 * 2025-06-04), or text like "22/07/2025" (DD/MM/YYYY, India). "-" and
 * blanks are no date. Always returns UTC midnight.
 */
export function parseSheetDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  if (typeof value === "number") return Number.isFinite(value) ? new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000) : null;
  if (typeof value === "string") {
    const m = /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\s*$/.exec(value);
    if (!m) return null;
    const [, d, mo, y] = m.map(Number);
    const date = new Date(Date.UTC(y, mo - 1, d));
    // Reject impossible dates like 31/02/2025 rather than rolling them over.
    return date.getUTCMonth() === mo - 1 && date.getUTCDate() === d ? date : null;
  }
  return null;
}

export type DigestInstrument = { description: string; ieIdNo: string | null; location: string | null; calibrationDue: Date | null };

/**
 * Weekly calibration digest text: overdue / not calibrated / due soon,
 * soonest first. Null when there's nothing to report.
 */
export function buildCalibrationDigest(
  instruments: DigestInstrument[],
  today: Date = new Date(),
  dueSoonDays: number = DEFAULT_DUE_SOON_DAYS,
): { subject: string; text: string; counts: Record<"OVERDUE" | "NOT_CALIBRATED" | "DUE_SOON", number> } | null {
  const fmt = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
  const label = (i: DigestInstrument) => `${i.ieIdNo ? `${i.ieIdNo} — ` : ""}${i.description}${i.location ? ` (${i.location})` : ""}`;
  const groups = { OVERDUE: [] as DigestInstrument[], NOT_CALIBRATED: [] as DigestInstrument[], DUE_SOON: [] as DigestInstrument[] };
  for (const i of instruments) {
    const s = calibrationStatus(i.calibrationDue, today, dueSoonDays);
    if (s !== "VALID") groups[s].push(i);
  }
  const byDue = (a: DigestInstrument, b: DigestInstrument) => (a.calibrationDue?.getTime() ?? 0) - (b.calibrationDue?.getTime() ?? 0);
  groups.OVERDUE.sort(byDue);
  groups.DUE_SOON.sort(byDue);

  const counts = { OVERDUE: groups.OVERDUE.length, NOT_CALIBRATED: groups.NOT_CALIBRATED.length, DUE_SOON: groups.DUE_SOON.length };
  if (counts.OVERDUE + counts.NOT_CALIBRATED + counts.DUE_SOON === 0) return null;

  const lines = [`Calibration status as of ${fmt(today)} (due-soon window: ${dueSoonDays} days)`, ""];
  if (counts.OVERDUE) {
    lines.push(`OVERDUE (${counts.OVERDUE}) — must not be used:`);
    for (const i of groups.OVERDUE) lines.push(`  • ${label(i)} — due ${fmt(i.calibrationDue!)}, ${-daysUntilDue(i.calibrationDue!, today)} day(s) ago`);
    lines.push("");
  }
  if (counts.NOT_CALIBRATED) {
    lines.push(`NOT CALIBRATED (${counts.NOT_CALIBRATED}):`);
    for (const i of groups.NOT_CALIBRATED) lines.push(`  • ${label(i)}`);
    lines.push("");
  }
  if (counts.DUE_SOON) {
    lines.push(`DUE SOON (${counts.DUE_SOON}):`);
    for (const i of groups.DUE_SOON) lines.push(`  • ${label(i)} — due ${fmt(i.calibrationDue!)}, in ${daysUntilDue(i.calibrationDue!, today)} day(s)`);
    lines.push("");
  }
  const subject = `Calibration: ${counts.OVERDUE} overdue, ${counts.DUE_SOON} due soon, ${counts.NOT_CALIBRATED} not calibrated`;
  return { subject, text: lines.join("\n").trimEnd(), counts };
}
