import { describe, expect, it } from "vitest";
import { AAR_DEFAULT_ROWS, formatLabPaintResult } from "./aar";

describe("AAR_DEFAULT_ROWS", () => {
  it("matches the 8 rows on the reference sheet, in order", () => {
    expect(AAR_DEFAULT_ROWS.map((r) => r.parameter)).toEqual([
      "Colour / Shade",
      "Gloss Level",
      "Surface Finish",
      "Paint Thickness",
      "Orange Peel",
      "Scratches / Dents",
      "Coating Adhesion",
      "Uniformity",
    ]);
  });

  it("links only DFT, adhesion and gloss to Lab Report paint results", () => {
    const linked = AAR_DEFAULT_ROWS.filter((r) => r.labPaintProperty).map((r) => [r.parameter, r.labPaintProperty]);
    expect(linked).toEqual([
      ["Gloss Level", "GLOSS"],
      ["Paint Thickness", "DFT"],
      ["Coating Adhesion", "ADHESION"],
    ]);
  });
});

describe("formatLabPaintResult", () => {
  it("adds OK/NG against a numeric requirement (gloss 80-90 GU)", () => {
    const base = { unit: "GU", requirementText: "80 GU to 90 GU", reportNo: "LAB-001" };
    expect(formatLabPaintResult({ ...base, resultText: "85", resultNumeric: 85 })).toBe("85 GU — OK (Lab report LAB-001)");
    expect(formatLabPaintResult({ ...base, resultText: "92", resultNumeric: 92 })).toBe("92 GU — NG (Lab report LAB-001)");
  });

  it("copies qualitative results without a status", () => {
    expect(
      formatLabPaintResult({ resultText: "No peel off", resultNumeric: null, unit: null, requirementText: "Cross hatch, no peel", reportNo: null }),
    ).toBe("No peel off (Lab report)");
  });

  it("returns null when the lab has no result yet", () => {
    expect(formatLabPaintResult({ resultText: null, resultNumeric: null, unit: null, requirementText: null, reportNo: "X" })).toBeNull();
  });
});
