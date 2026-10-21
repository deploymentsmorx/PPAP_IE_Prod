import { describe, expect, it } from "vitest";
import {
  subgroupConstants,
  subgroupMean,
  subgroupRange,
  computeControlChartStats,
  overallSigma,
  computeCapability,
  computeClientMethod,
  countOutOfSpec,
  computeHistogram,
  spcVerdict,
  spcRemark,
} from "./spc";

// Real element-11 sample (part 1368082, Ø76 -0.355/0, USL=76/LSL=75.645),
// 5 subgroups of 5. The "11. SPC Results-1" grid and "11. SPC Results-2"
// flat data row disagree on one cell (subgroup 1, 3rd reading: 75.76 vs
// 75.755) — a known transcription mismatch between the two legacy sheets
// this element replaces. The flat sheet's value (75.755) is used here;
// see CLAUDE.md "computed values win" and the Page 11 prompt history.
const USL = 76;
const LSL = 75.645;
const SUBGROUPS = [
  [75.862, 75.789, 75.755, 75.854, 75.875],
  [75.75, 75.894, 75.858, 75.862, 75.755],
  [75.758, 75.898, 75.855, 75.9, 75.844],
  [75.895, 75.787, 75.902, 75.89, 75.904],
  [75.882, 75.859, 75.785, 75.758, 75.875],
];
const ALL_READINGS = SUBGROUPS.flat();

describe("subgroupConstants", () => {
  it("returns the standard A2/D3/D4/d2 table for n=5", () => {
    expect(subgroupConstants(5)).toEqual({ a2: 0.577, d3: 0, d4: 2.114, d2: 2.326 });
  });

  it("throws for an untabulated subgroup size", () => {
    expect(() => subgroupConstants(1)).toThrow();
    expect(() => subgroupConstants(16)).toThrow();
  });
});

describe("subgroupMean / subgroupRange", () => {
  it("computes mean and range of a subgroup", () => {
    expect(subgroupMean([1, 2, 3])).toBe(2);
    expect(subgroupRange([1, 5, 3])).toBe(4);
  });
});

describe("computeControlChartStats", () => {
  const stats = computeControlChartStats(SUBGROUPS);

  it("computes X̄-bar and R-bar", () => {
    expect(stats.xBarBar).toBeCloseTo(75.84184, 5);
    expect(stats.rBar).toBeCloseTo(0.1294, 4);
  });

  it("computes sigma-within from R-bar/d2", () => {
    expect(stats.sigmaWithin).toBeCloseTo(0.055632, 6);
  });

  it("computes X̄ chart control limits using the standard A2 (not the sheet's own typo'd constant)", () => {
    expect(stats.xBarUcl).toBeCloseTo(75.9165, 4);
    expect(stats.xBarLcl).toBeCloseTo(75.7672, 4);
  });

  it("computes R chart control limits (D3=0 for n=5, so LCL is 0)", () => {
    expect(stats.rUcl).toBeCloseTo(0.27355, 4);
    expect(stats.rLcl).toBe(0);
  });

  it("throws if subgroups are uneven", () => {
    expect(() => computeControlChartStats([[1, 2, 3], [1, 2]])).toThrow();
  });
});

describe("overallSigma", () => {
  it("matches the sheet's own Std.Dev. \"s\" for this sample", () => {
    // Computed on the corrected 25-reading set; the sheet's own figure
    // (0.055209...) was computed on its uncorrected data — see fixture note.
    expect(overallSigma(ALL_READINGS)).toBeCloseTo(0.055527, 6);
  });
});

describe("computeCapability (standard, sigma-within based)", () => {
  const stats = computeControlChartStats(SUBGROUPS);
  const overallMean = subgroupMean(ALL_READINGS);
  const sigmaOverall = overallSigma(ALL_READINGS);
  const cap = computeCapability({ usl: USL, lsl: LSL, xBarBar: stats.xBarBar, overallMean, sigmaWithin: stats.sigmaWithin, sigmaOverall });

  it("computes Cp/Cpk from sigma-within", () => {
    expect(cap.cp).toBeCloseTo(1.0635, 3);
    expect(cap.cpk).toBeCloseTo(0.9477, 3);
  });

  it("computes Pp/Ppk from sigma-overall", () => {
    expect(cap.pp).toBeCloseTo(1.0656, 3);
    expect(cap.ppk).toBeCloseTo(0.9495, 3);
  });
});

describe("computeClientMethod", () => {
  const overallMean = subgroupMean(ALL_READINGS);
  const sigmaOverall = overallSigma(ALL_READINGS);
  const result = computeClientMethod({ usl: USL, lsl: LSL, mean: overallMean, sigmaOverall });

  it("computes the design centre and spec width", () => {
    expect(result.designCentre).toBeCloseTo(75.8225, 4);
    expect(result.specWidth).toBeCloseTo(0.355, 3);
  });

  it("computes K and Cp/Cpk per the client's own formula", () => {
    expect(result.k).toBeCloseTo(0.10896, 4);
    expect(result.cp).toBeCloseTo(1.0656, 3);
    expect(result.cpk).toBeCloseTo(0.9495, 3);
  });

  // Acceptance: the sample's 25 readings give Cp 1.066 / Cpk 0.949 with
  // the client method — the sheet's own typed 1.072/0.9537 (SPC-1) /
  // 0.9537 (SPC-2) used its uncorrected data and a typo'd A2; computed
  // values win per CLAUDE.md.
  it("rounds to the client's sheet precision as 1.066 / 0.949, not the sheet's typed 1.072 / 0.954", () => {
    expect(result.cp.toFixed(3)).toBe("1.066");
    expect(result.cpk.toFixed(3)).toBe("0.949");
  });
});

describe("countOutOfSpec", () => {
  it("counts no out-of-spec readings for this sample (all within 75.645-76)", () => {
    expect(countOutOfSpec(ALL_READINGS, USL, LSL)).toEqual({ aboveUsl: 0, belowLsl: 0 });
  });

  it("counts readings above USL and below LSL", () => {
    expect(countOutOfSpec([1, 5, 10, 15], 12, 3)).toEqual({ aboveUsl: 1, belowLsl: 1 });
  });
});

describe("computeHistogram", () => {
  it("builds 5 equal-width classes spanning min-max with frequencies summing to n", () => {
    const classes = computeHistogram(ALL_READINGS, 5);
    expect(classes).toHaveLength(5);
    expect(classes[0].from).toBeCloseTo(75.75, 4);
    expect(classes[4].to).toBeCloseTo(75.904, 4);
    expect(classes.reduce((sum, c) => sum + c.frequency, 0)).toBe(25);
    expect(classes[classes.length - 1].cumulativeFrequency).toBe(25);
  });

  it("returns an empty array for no data", () => {
    expect(computeHistogram([])).toEqual([]);
  });
});

describe("spcVerdict / spcRemark", () => {
  it("is ACCEPTABLE at/above 1.67", () => {
    expect(spcVerdict(1.67)).toBe("ACCEPTABLE");
    expect(spcVerdict(2.0)).toBe("ACCEPTABLE");
  });

  it("is CONDITIONAL between 1.33 and 1.67", () => {
    expect(spcVerdict(1.5)).toBe("CONDITIONAL");
  });

  it("is NOT_ACCEPTABLE below 1.33 — this sample's Cpk (0.949) included", () => {
    expect(spcVerdict(0.9494517724745279)).toBe("NOT_ACCEPTABLE");
    expect(spcVerdict(1.0)).toBe("NOT_ACCEPTABLE");
  });

  it("respects customer-configurable thresholds", () => {
    expect(spcVerdict(1.2, { acceptable: 1.5, conditional: 1.0 })).toBe("CONDITIONAL");
  });

  it("generates remark text naming the verdict and Cpk", () => {
    expect(spcRemark(0.949)).toMatch(/NOT capable/);
    expect(spcRemark(0.949)).toContain("0.949");
    expect(spcRemark(1.8)).toMatch(/capable/);
  });
});
