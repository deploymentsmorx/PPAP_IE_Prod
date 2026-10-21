/**
 * AIAG Average & Range method for Variable Gage R&R (MSA 4th edition).
 * K1/K2/K3 constants are the "5.15/d2*" form (so EV/AV/GRR/PV/TV come out
 * directly in measurement units, not sigma units) — cross-validated this
 * session against multiple independent published sources for the K1
 * (trials), K2 (appraisers) and K3 (parts 2-10) tables. Parts 11-15 use the
 * commonly-reproduced table continuation; parts outside 2-15 aren't
 * tabulated here and throw rather than guess.
 */

export type MsaVerdict = "ACCEPTABLE" | "CONDITIONALLY_ACCEPTABLE" | "NOT_ACCEPTABLE";

const K1_TABLE: Record<number, number> = { 2: 4.56, 3: 3.05 };
const K2_TABLE: Record<number, number> = { 2: 3.65, 3: 2.7 };
const K3_TABLE: Record<number, number> = {
  2: 3.65,
  3: 2.7,
  4: 2.3,
  5: 2.08,
  6: 1.93,
  7: 1.82,
  8: 1.74,
  9: 1.67,
  10: 1.62,
  11: 1.58,
  12: 1.54,
  13: 1.51,
  14: 1.48,
  15: 1.46,
};

// Standard SPC subgroup constants for the by-appraiser X-bar/R control
// charts (subgroup size = number of trials).
const A2_TABLE: Record<number, number> = { 2: 1.88, 3: 1.023 };
const D3_TABLE: Record<number, number> = { 2: 0, 3: 0 };
const D4_TABLE: Record<number, number> = { 2: 3.267, 3: 2.574 };

export function k1(trials: number): number {
  const v = K1_TABLE[trials];
  if (v === undefined) throw new Error(`No K1 constant tabulated for ${trials} trials (supported: 2-3).`);
  return v;
}

export function k2(appraisers: number): number {
  const v = K2_TABLE[appraisers];
  if (v === undefined) throw new Error(`No K2 constant tabulated for ${appraisers} appraisers (supported: 2-3).`);
  return v;
}

export function k3(parts: number): number {
  const v = K3_TABLE[parts];
  if (v === undefined) throw new Error(`No K3 constant tabulated for ${parts} parts (supported: 2-15).`);
  return v;
}

export function controlChartConstants(trials: number): { a2: number; d3: number; d4: number } {
  const a2 = A2_TABLE[trials];
  const d3 = D3_TABLE[trials];
  const d4 = D4_TABLE[trials];
  if (a2 === undefined || d3 === undefined || d4 === undefined) {
    throw new Error(`No control-chart constants tabulated for ${trials} trials (supported: 2-3).`);
  }
  return { a2, d3, d4 };
}

function range(values: number[]): number {
  return Math.max(...values) - Math.min(...values);
}

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** readings[appraiserIndex][partIndex][trialIndex] */
export type GrrReadings = number[][][];

export type GrrInput = {
  readings: GrrReadings;
  parts: number;
  appraisers: number;
  trials: number;
  usl?: number | null;
  lsl?: number | null;
};

export type GrrResult = {
  rBarPerAppraiser: number[];
  rBar: number;
  appraiserGrandAverage: number[];
  xBarDiff: number;
  partAverage: number[];
  rp: number;

  ev: number;
  av: number;
  grr: number;
  pv: number;
  tv: number;

  pctEvOfTv: number;
  pctAvOfTv: number;
  pctGrrOfTv: number;
  pctPvOfTv: number;

  tolerance: number | null;
  pctEvOfTolerance: number | null;
  pctAvOfTolerance: number | null;
  pctGrrOfTolerance: number | null;
  pctPvOfTolerance: number | null;

  ndc: number;
  verdict: MsaVerdict;
  /** %GRR the verdict was based on — vs tolerance when one is given, else vs TV. */
  verdictBasisPercent: number;
};

export function verdictForPercent(pctGrr: number): MsaVerdict {
  if (pctGrr < 10) return "ACCEPTABLE";
  if (pctGrr <= 30) return "CONDITIONALLY_ACCEPTABLE";
  return "NOT_ACCEPTABLE";
}

export function calculateGrr(input: GrrInput): GrrResult {
  const { readings, parts, appraisers, trials, usl, lsl } = input;

  const rBarPerAppraiser = readings.map((byPart) => mean(byPart.map((byTrial) => range(byTrial))));
  const rBar = mean(rBarPerAppraiser);

  const appraiserGrandAverage = readings.map((byPart) => mean(byPart.flat()));
  const xBarDiff = range(appraiserGrandAverage);

  const partAverage: number[] = [];
  for (let p = 0; p < parts; p++) {
    const allForPart: number[] = [];
    for (let a = 0; a < appraisers; a++) {
      for (let t = 0; t < trials; t++) allForPart.push(readings[a][p][t]);
    }
    partAverage.push(mean(allForPart));
  }
  const rp = range(partAverage);

  const K1 = k1(trials);
  const K2 = k2(appraisers);
  const K3 = k3(parts);

  const ev = rBar * K1;
  const avInner = (xBarDiff * K2) ** 2 - ev ** 2 / (parts * trials);
  const av = avInner > 0 ? Math.sqrt(avInner) : 0;
  const grr = Math.sqrt(ev ** 2 + av ** 2);
  const pv = rp * K3;
  const tv = Math.sqrt(grr ** 2 + pv ** 2);

  const pctOfTv = (x: number) => (tv > 0 ? (100 * x) / tv : 0);
  const pctEvOfTv = pctOfTv(ev);
  const pctAvOfTv = pctOfTv(av);
  const pctGrrOfTv = pctOfTv(grr);
  const pctPvOfTv = pctOfTv(pv);

  const tolerance = usl != null && lsl != null ? usl - lsl : null;
  const pctOfTolerance = (x: number) => (tolerance && tolerance > 0 ? (100 * x) / tolerance : null);
  const pctEvOfTolerance = pctOfTolerance(ev);
  const pctAvOfTolerance = pctOfTolerance(av);
  const pctGrrOfTolerance = pctOfTolerance(grr);
  const pctPvOfTolerance = pctOfTolerance(pv);

  const ndc = grr > 0 ? Math.floor(1.41 * (pv / grr)) : 0;

  const verdictBasisPercent = pctGrrOfTolerance ?? pctGrrOfTv;
  const verdict = verdictForPercent(verdictBasisPercent);

  return {
    rBarPerAppraiser,
    rBar,
    appraiserGrandAverage,
    xBarDiff,
    partAverage,
    rp,
    ev,
    av,
    grr,
    pv,
    tv,
    pctEvOfTv,
    pctAvOfTv,
    pctGrrOfTv,
    pctPvOfTv,
    tolerance,
    pctEvOfTolerance,
    pctAvOfTolerance,
    pctGrrOfTolerance,
    pctPvOfTolerance,
    ndc,
    verdict,
    verdictBasisPercent,
  };
}

export type RangeChartPoint = { partLabel: string; appraiserIndex: number; range: number };

export function rangeChartPoints(readings: GrrReadings, partLabels: string[]): RangeChartPoint[] {
  const points: RangeChartPoint[] = [];
  readings.forEach((byPart, appraiserIndex) => {
    byPart.forEach((byTrial, partIndex) => {
      points.push({ partLabel: partLabels[partIndex] ?? String(partIndex + 1), appraiserIndex, range: range(byTrial) });
    });
  });
  return points;
}

export type AverageChartPoint = { partLabel: string; appraiserIndex: number; average: number };

export function averageChartPoints(readings: GrrReadings, partLabels: string[]): AverageChartPoint[] {
  const points: AverageChartPoint[] = [];
  readings.forEach((byPart, appraiserIndex) => {
    byPart.forEach((byTrial, partIndex) => {
      points.push({ partLabel: partLabels[partIndex] ?? String(partIndex + 1), appraiserIndex, average: mean(byTrial) });
    });
  });
  return points;
}
