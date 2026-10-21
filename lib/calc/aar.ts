/**
 * Element 13 (AAR) pure helpers: the 8 appearance-criteria rows exactly as
 * written on the reference sheet "13. AAR", and formatting a Lab Report
 * (element 12) paint result into an AAR Result cell.
 */

import { computeNumericStatus } from "@/lib/calc/lab";
import { parseRangeText } from "@/lib/calc/tolerance";

export type AarPaintProperty = "DFT" | "ADHESION" | "GLOSS";

export const AAR_DEFAULT_ROWS: {
  parameter: string;
  specification: string;
  evaluationMethod: string;
  acceptanceCriteria: string;
  labPaintProperty: AarPaintProperty | null;
}[] = [
  { parameter: "Colour / Shade", specification: "As per master sample", evaluationMethod: "Visual / Spectro", acceptanceCriteria: "Within tolerance", labPaintProperty: null },
  { parameter: "Gloss Level", specification: "60° Gloss meter value", evaluationMethod: "Instrument", acceptanceCriteria: "± tolerance", labPaintProperty: "GLOSS" },
  { parameter: "Surface Finish", specification: "Smooth / Textured", evaluationMethod: "Visual / Comparator", acceptanceCriteria: "No defects", labPaintProperty: null },
  { parameter: "Paint Thickness", specification: "µm range", evaluationMethod: "DFT Gauge", acceptanceCriteria: "As per spec", labPaintProperty: "DFT" },
  { parameter: "Orange Peel", specification: "Visual standard", evaluationMethod: "Visual", acceptanceCriteria: "Within limit", labPaintProperty: null },
  { parameter: "Scratches / Dents", specification: "Not allowed", evaluationMethod: "Visual", acceptanceCriteria: "Zero defect", labPaintProperty: null },
  { parameter: "Coating Adhesion", specification: "Cross hatch test", evaluationMethod: "Test method", acceptanceCriteria: "Pass", labPaintProperty: "ADHESION" },
  { parameter: "Uniformity", specification: "Even coating", evaluationMethod: "Visual", acceptanceCriteria: "No variation", labPaintProperty: null },
];

/**
 * "85 µm — OK (Lab report LAB-001)". OK/NG is added only when the lab
 * requirement is a numeric range (same rule as element 12's own status);
 * qualitative results ("No peel off") are copied as-is.
 */
export function formatLabPaintResult(paint: {
  resultText: string | null;
  resultNumeric: number | null;
  unit: string | null;
  requirementText: string | null;
  reportNo: string | null;
}): string | null {
  if (!paint.resultText) return null;
  const value = paint.unit ? `${paint.resultText} ${paint.unit}` : paint.resultText;
  const range = parseRangeText(paint.requirementText);
  const status = range && paint.resultNumeric != null ? computeNumericStatus(paint.resultNumeric, range.min, range.max) : "UNKNOWN";
  const statusPart = status === "UNKNOWN" ? "" : ` — ${status}`;
  const source = paint.reportNo ? ` (Lab report ${paint.reportNo})` : " (Lab report)";
  return `${value}${statusPart}${source}`;
}
