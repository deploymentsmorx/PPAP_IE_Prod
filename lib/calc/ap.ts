/**
 * AIAG & VDA FMEA Handbook (1st edition, 2019) PFMEA Action Priority (AP)
 * table. Severity, Occurrence and Detection are each grouped into five
 * 2-wide bands (1-2, 3-4, 5-6, 7-8, 9-10); the table is indexed
 * [sBand][oBand][dBand], all ascending from the low band (index 0) to the
 * high band (index 4).
 *
 * Severity dominates, then Occurrence, then Detection — within every row,
 * AP is monotonically non-decreasing as any of S, O, D increases. Spot
 * checked against the reference workbook's known case (S9, O5, D2 → High).
 */

export type ApLevel = "HIGH" | "MEDIUM" | "LOW";

export const SOD_MIN = 1;
export const SOD_MAX = 10;

/** Which of the five 2-wide bands (0-4) a 1-10 S/O/D rating falls into. */
export function bandOf(value: number): number {
  return Math.min(4, Math.max(0, Math.floor((value - 1) / 2)));
}

// [sBand][oBand] -> AP per dBand 0..4 (dBand ascending = detection getting worse)
const AP_TABLE: ApLevel[][][] = [
  // sBand 0 (S 1-2): severity this low is always Low regardless of O/D.
  [
    ["LOW", "LOW", "LOW", "LOW", "LOW"], // oBand 0
    ["LOW", "LOW", "LOW", "LOW", "LOW"], // oBand 1
    ["LOW", "LOW", "LOW", "LOW", "LOW"], // oBand 2
    ["LOW", "LOW", "LOW", "LOW", "LOW"], // oBand 3
    ["LOW", "LOW", "LOW", "LOW", "LOW"], // oBand 4
  ],
  // sBand 1 (S 3-4)
  [
    ["LOW", "LOW", "LOW", "LOW", "MEDIUM"], // oBand 0 (O 1-2)
    ["LOW", "LOW", "LOW", "MEDIUM", "MEDIUM"], // oBand 1 (O 3-4)
    ["LOW", "LOW", "MEDIUM", "MEDIUM", "HIGH"], // oBand 2 (O 5-6)
    ["LOW", "MEDIUM", "MEDIUM", "HIGH", "HIGH"], // oBand 3 (O 7-8)
    ["MEDIUM", "MEDIUM", "HIGH", "HIGH", "HIGH"], // oBand 4 (O 9-10)
  ],
  // sBand 2 (S 5-6)
  [
    ["LOW", "LOW", "LOW", "MEDIUM", "MEDIUM"], // oBand 0
    ["LOW", "LOW", "MEDIUM", "MEDIUM", "HIGH"], // oBand 1
    ["LOW", "MEDIUM", "MEDIUM", "HIGH", "HIGH"], // oBand 2
    ["MEDIUM", "MEDIUM", "HIGH", "HIGH", "HIGH"], // oBand 3
    ["MEDIUM", "HIGH", "HIGH", "HIGH", "HIGH"], // oBand 4
  ],
  // sBand 3 (S 7-8)
  [
    ["LOW", "LOW", "MEDIUM", "MEDIUM", "HIGH"], // oBand 0
    ["LOW", "MEDIUM", "MEDIUM", "HIGH", "HIGH"], // oBand 1
    ["MEDIUM", "MEDIUM", "HIGH", "HIGH", "HIGH"], // oBand 2
    ["MEDIUM", "HIGH", "HIGH", "HIGH", "HIGH"], // oBand 3
    ["HIGH", "HIGH", "HIGH", "HIGH", "HIGH"], // oBand 4
  ],
  // sBand 4 (S 9-10)
  [
    ["LOW", "MEDIUM", "HIGH", "HIGH", "HIGH"], // oBand 0
    ["MEDIUM", "HIGH", "HIGH", "HIGH", "HIGH"], // oBand 1
    ["HIGH", "HIGH", "HIGH", "HIGH", "HIGH"], // oBand 2
    ["HIGH", "HIGH", "HIGH", "HIGH", "HIGH"], // oBand 3
    ["HIGH", "HIGH", "HIGH", "HIGH", "HIGH"], // oBand 4
  ],
];

export function calculateActionPriority(severity: number, occurrence: number, detection: number): ApLevel {
  return AP_TABLE[bandOf(severity)][bandOf(occurrence)][bandOf(detection)];
}

/** Normalizes free-typed AP text ("High", "H", "high ", "Med") from an
 * Excel import to the enum, for comparing against the computed value. */
export function parseApText(text: string | null | undefined): ApLevel | null {
  if (!text) return null;
  const t = text.trim().toUpperCase();
  if (t === "H" || t === "HIGH") return "HIGH";
  if (t === "M" || t === "MED" || t === "MEDIUM") return "MEDIUM";
  if (t === "L" || t === "LOW") return "LOW";
  return null;
}
