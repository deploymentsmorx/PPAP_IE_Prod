import { describe, expect, it } from "vitest";
import {
  k1,
  k2,
  k3,
  controlChartConstants,
  calculateGrr,
  verdictForPercent,
  rangeChartPoints,
  averageChartPoints,
  type GrrReadings,
} from "./grr";

describe("constant tables", () => {
  it("looks up K1/K2/K3 for supported counts", () => {
    expect(k1(2)).toBe(4.56);
    expect(k1(3)).toBe(3.05);
    expect(k2(2)).toBe(3.65);
    expect(k2(3)).toBe(2.7);
    expect(k3(10)).toBe(1.62);
    expect(k3(5)).toBe(2.08);
  });

  it("throws rather than guessing outside the tabulated range", () => {
    expect(() => k1(4)).toThrow();
    expect(() => k2(4)).toThrow();
    expect(() => k3(1)).toThrow();
    expect(() => k3(16)).toThrow();
  });

  it("looks up X-bar/R control-chart constants by trial count", () => {
    expect(controlChartConstants(2)).toEqual({ a2: 1.88, d3: 0, d4: 3.267 });
    expect(controlChartConstants(3)).toEqual({ a2: 1.023, d3: 0, d4: 2.574 });
  });
});

// Hand-derived fixture (not a transcription of the AIAG manual's own
// example — see the cross-check below for that). 2 appraisers, 3 parts, 2
// trials, constructed so every intermediate value is exact by construction:
// every reading pair has range exactly 2 (so R-bar = 2 for both
// appraisers), appraiser B's readings are every one of A's +4 (so
// X-bar-diff = 4 exactly), and the three part averages are 12/22/32 (so
// Rp = 20 exactly). That isolates the matrix-indexing/mean/range logic
// (the part most likely to contain a bug) from the sqrt arithmetic, which
// was independently computed (not via this module) to get the expected
// EV/AV/GRR/PV/TV/ndc below.
const READINGS: GrrReadings = [
  [
    [9, 11],
    [19, 21],
    [29, 31],
  ],
  [
    [13, 15],
    [23, 25],
    [33, 35],
  ],
];

describe("calculateGrr", () => {
  it("matches independently-computed values for the hand-derived fixture", () => {
    const result = calculateGrr({ readings: READINGS, parts: 3, appraisers: 2, trials: 2 });

    expect(result.rBarPerAppraiser).toEqual([2, 2]);
    expect(result.rBar).toBe(2);
    expect(result.appraiserGrandAverage).toEqual([20, 24]);
    expect(result.xBarDiff).toBe(4);
    expect(result.partAverage).toEqual([12, 22, 32]);
    expect(result.rp).toBe(20);

    expect(result.ev).toBeCloseTo(9.12, 6);
    expect(result.av).toBeCloseTo(14.11728019131164, 6);
    expect(result.grr).toBeCloseTo(16.80690334356689, 6);
    expect(result.pv).toBeCloseTo(54, 6);
    expect(result.tv).toBeCloseTo(56.55503514277044, 6);

    expect(result.pctEvOfTv).toBeCloseTo(16.12588512583716, 6);
    expect(result.pctAvOfTv).toBeCloseTo(24.962021782275, 6);
    expect(result.pctGrrOfTv).toBeCloseTo(29.71778428063687, 6);
    expect(result.pctPvOfTv).toBeCloseTo(95.48221456087795, 6);

    expect(result.ndc).toBe(4);
    // %GRR vs TV is ~29.7%, inside the 10-30% band.
    expect(result.verdict).toBe("CONDITIONALLY_ACCEPTABLE");
  });

  it("clips AV to 0 when the formula would go negative", () => {
    // Two appraisers with identical readings (and therefore identical
    // grand averages) and very large repeatability scatter drives the AV
    // radicand negative; AV must clip to 0, not NaN.
    const readings: GrrReadings = [
      [
        [0, 100],
        [0, 100],
        [0, 100],
      ],
      [
        [0, 100],
        [0, 100],
        [0, 100],
      ],
    ];
    const result = calculateGrr({ readings, parts: 3, appraisers: 2, trials: 2 });
    expect(result.xBarDiff).toBe(0);
    expect(result.av).toBe(0);
  });

  it("computes verdict against tolerance when USL/LSL are given, instead of against TV", () => {
    const resultWide = calculateGrr({ readings: READINGS, parts: 3, appraisers: 2, trials: 2, usl: 100, lsl: -100 });
    expect(resultWide.tolerance).toBe(200);
    expect(resultWide.pctGrrOfTolerance).toBeCloseTo((100 * 16.80690334356689) / 200, 6);
    expect(resultWide.verdict).toBe("ACCEPTABLE"); // ~8.4% of a wide tolerance
    expect(resultWide.verdictBasisPercent).toBeCloseTo(resultWide.pctGrrOfTolerance!, 6);

    const resultNoTolerance = calculateGrr({ readings: READINGS, parts: 3, appraisers: 2, trials: 2 });
    expect(resultNoTolerance.tolerance).toBeNull();
    expect(resultNoTolerance.verdictBasisPercent).toBeCloseTo(resultNoTolerance.pctGrrOfTv, 6);
  });

  it("matches the 10-part/3-appraiser/3-trial K1/K2/K3 constants used in the acceptance scenario", () => {
    expect(k1(3)).toBe(3.05);
    expect(k2(3)).toBe(2.7);
    expect(k3(10)).toBe(1.62);
  });
});

describe("verdictForPercent", () => {
  it("applies the 10% / 30% AIAG bands", () => {
    expect(verdictForPercent(9.99)).toBe("ACCEPTABLE");
    expect(verdictForPercent(10)).toBe("CONDITIONALLY_ACCEPTABLE");
    expect(verdictForPercent(30)).toBe("CONDITIONALLY_ACCEPTABLE");
    expect(verdictForPercent(30.01)).toBe("NOT_ACCEPTABLE");
  });
});

// Partial cross-check against a published worked example (flange-thickness
// Gage R&R, 10 parts / 3 appraisers / 3 trials) from
// https://www.theleansuite.com/templates/gage-rr-study-sheet, which reports
// per-appraiser average ranges of 0.0058/0.0074/0.0064 mm and EV = 0.00386mm
// using the "1/d2*" K1 convention (K1=0.5908 for 3 trials, i.e. this
// module's K1 divided by 5.15). This only validates the R-bar -> EV step
// (the step most sensitive to picking the right K-constant convention), not
// the full GRR/ndc chain, since the source doesn't publish its raw 90
// readings or X-bar-diff/Rp inputs.
describe("cross-check against a published example", () => {
  it("reproduces the published EV for the flange-thickness R-bar values, once rescaled to this module's K1 convention", () => {
    const rBar = (0.0058 + 0.0074 + 0.0064) / 3;
    expect(rBar).toBeCloseTo(0.006533, 5);

    const evBigConvention = rBar * k1(3);
    const evPublishedConvention = evBigConvention / 5.15;
    expect(evPublishedConvention).toBeCloseTo(0.00386, 3);
  });
});

describe("chart point helpers", () => {
  it("flattens readings into one range point and one average point per appraiser/part", () => {
    const rangePts = rangeChartPoints(READINGS, ["P1", "P2", "P3"]);
    expect(rangePts).toHaveLength(6);
    expect(rangePts.every((p) => p.range === 2)).toBe(true);

    const avgPts = averageChartPoints(READINGS, ["P1", "P2", "P3"]);
    expect(avgPts).toHaveLength(6);
    expect(avgPts.find((p) => p.appraiserIndex === 0 && p.partLabel === "P1")?.average).toBe(10);
    expect(avgPts.find((p) => p.appraiserIndex === 1 && p.partLabel === "P3")?.average).toBe(34);
  });
});
