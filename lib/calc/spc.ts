/**
 * Element 11 (SPC Results) calculations. One subgroup grid drives both the
 * X̄-R / histogram view (reference sheet "11. SPC Results-1") and the
 * individuals run chart view ("11. SPC Results-2") — flattening the
 * subgroups in row-major order gives the individuals sequence.
 *
 * A2/D3/D4/d2 are the standard tabulated AIAG/ASTM subgroup constants
 * (n=2-15); the reference sheet's own embedded copy of this table has
 * several typo'd entries (e.g. n=4 D4 shown as 2.230 vs the correct 2.282)
 * that were then used in its own X̄-chart UCL, so this file intentionally
 * does NOT reproduce the sheet's numbers — see CLAUDE.md "computed values
 * win". Verified against the reference workbook's real 25-reading sample
 * (part 1368082, Ø76-0.355 spec): lib/calc/spc.test.ts.
 */

export type SubgroupConstants = { a2: number; d3: number; d4: number; d2: number };

const SUBGROUP_CONSTANTS: Record<number, SubgroupConstants> = {
  2: { a2: 1.88, d3: 0, d4: 3.267, d2: 1.128 },
  3: { a2: 1.023, d3: 0, d4: 2.574, d2: 1.693 },
  4: { a2: 0.729, d3: 0, d4: 2.282, d2: 2.059 },
  5: { a2: 0.577, d3: 0, d4: 2.114, d2: 2.326 },
  6: { a2: 0.483, d3: 0, d4: 2.004, d2: 2.534 },
  7: { a2: 0.419, d3: 0.076, d4: 1.924, d2: 2.704 },
  8: { a2: 0.373, d3: 0.136, d4: 1.864, d2: 2.847 },
  9: { a2: 0.337, d3: 0.184, d4: 1.816, d2: 2.97 },
  10: { a2: 0.308, d3: 0.223, d4: 1.777, d2: 3.078 },
  11: { a2: 0.285, d3: 0.256, d4: 1.744, d2: 3.173 },
  12: { a2: 0.266, d3: 0.283, d4: 1.717, d2: 3.258 },
  13: { a2: 0.249, d3: 0.307, d4: 1.693, d2: 3.336 },
  14: { a2: 0.235, d3: 0.328, d4: 1.672, d2: 3.407 },
  15: { a2: 0.223, d3: 0.347, d4: 1.653, d2: 3.472 },
};

export function subgroupConstants(n: number): SubgroupConstants {
  const c = SUBGROUP_CONSTANTS[n];
  if (!c) throw new Error(`No A2/D3/D4/d2 constants tabulated for subgroup size ${n} (supported: 2-15).`);
  return c;
}

export function subgroupMean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function subgroupRange(values: number[]): number {
  return Math.max(...values) - Math.min(...values);
}

export type ControlChartStats = {
  n: number;
  xBarBar: number;
  rBar: number;
  sigmaWithin: number;
  xBarUcl: number;
  xBarLcl: number;
  rUcl: number;
  rLcl: number;
};

/// `subgroups` is row-major: one array per subgroup, all the same length.
export function computeControlChartStats(subgroups: number[][]): ControlChartStats {
  if (subgroups.length === 0 || subgroups.some((sg) => sg.length !== subgroups[0].length)) {
    throw new Error("All subgroups must be non-empty and the same size.");
  }
  const n = subgroups[0].length;
  const { a2, d3, d4, d2 } = subgroupConstants(n);

  const means = subgroups.map(subgroupMean);
  const ranges = subgroups.map(subgroupRange);
  const xBarBar = subgroupMean(means);
  const rBar = subgroupMean(ranges);
  const sigmaWithin = rBar / d2;

  return {
    n,
    xBarBar,
    rBar,
    sigmaWithin,
    xBarUcl: xBarBar + a2 * rBar,
    xBarLcl: xBarBar - a2 * rBar,
    rUcl: d4 * rBar,
    rLcl: d3 * rBar,
  };
}

/// Sample standard deviation (n-1 denominator — Excel's STDEV/STDEV.S).
export function overallSigma(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = subgroupMean(values);
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export type Capability = { cp: number; cpk: number; pp: number; ppk: number };

export function computeCapability(opts: { usl: number; lsl: number; xBarBar: number; overallMean: number; sigmaWithin: number; sigmaOverall: number }): Capability {
  const { usl, lsl, xBarBar, overallMean, sigmaWithin, sigmaOverall } = opts;
  const spec = usl - lsl;

  const cp = spec / (6 * sigmaWithin);
  const cpk = Math.min((usl - xBarBar) / (3 * sigmaWithin), (xBarBar - lsl) / (3 * sigmaWithin));

  const pp = spec / (6 * sigmaOverall);
  const ppk = Math.min((usl - overallMean) / (3 * sigmaOverall), (overallMean - lsl) / (3 * sigmaOverall));

  return { cp, cpk, pp, ppk };
}

export type ClientMethodResult = { designCentre: number; specWidth: number; k: number; cp: number; cpk: number };

/**
 * The client's own worksheet formula, preserved for continuity: process
 * width is expressed via the spec band (S) and the mean's offset from the
 * design centre (D) rather than one-sided distances. Cp = S/(6s), Cpk =
 * (1-K)*Cp where K = 2|D-mean|/S and s = overall (STDEV) sigma — this is
 * algebraically the Pp/Ppk pair under the client's own "Cp"/"Cpk" labels.
 */
export function computeClientMethod(opts: { usl: number; lsl: number; mean: number; sigmaOverall: number }): ClientMethodResult {
  const { usl, lsl, mean, sigmaOverall } = opts;
  const designCentre = (usl + lsl) / 2;
  const specWidth = usl - lsl;
  const k = (2 * Math.abs(designCentre - mean)) / specWidth;
  const cp = specWidth / (6 * sigmaOverall);
  const cpk = (1 - k) * cp;
  return { designCentre, specWidth, k, cp, cpk };
}

export function countOutOfSpec(values: number[], usl: number, lsl: number): { aboveUsl: number; belowLsl: number } {
  return {
    aboveUsl: values.filter((v) => v > usl).length,
    belowLsl: values.filter((v) => v < lsl).length,
  };
}

export type HistogramClass = { from: number; to: number; frequency: number; cumulativeFrequency: number };

/// Equal-width classes spanning the data's own min-max range (matches the
/// reference sheet's "Process Width / no. of classes" method), not the
/// data's full UCL-LCL/spec range.
export function computeHistogram(values: number[], classCount = 5): HistogramClass[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = (max - min) / classCount || 1;

  const classes: HistogramClass[] = [];
  let cumulative = 0;
  for (let i = 0; i < classCount; i++) {
    const from = min + i * width;
    const to = i === classCount - 1 ? max : min + (i + 1) * width;
    const frequency = values.filter((v) => (i === classCount - 1 ? v >= from && v <= to : v >= from && v < to)).length;
    cumulative += frequency;
    classes.push({ from, to, frequency, cumulativeFrequency: cumulative });
  }
  return classes;
}

export type SpcVerdict = "ACCEPTABLE" | "CONDITIONAL" | "NOT_ACCEPTABLE";

export function spcVerdict(cpk: number, thresholds: { acceptable: number; conditional: number } = { acceptable: 1.67, conditional: 1.33 }): SpcVerdict {
  if (cpk >= thresholds.acceptable) return "ACCEPTABLE";
  if (cpk >= thresholds.conditional) return "CONDITIONAL";
  return "NOT_ACCEPTABLE";
}

export function spcRemark(cpk: number, thresholds: { acceptable: number; conditional: number } = { acceptable: 1.67, conditional: 1.33 }): string {
  const verdict = spcVerdict(cpk, thresholds);
  const cpkText = cpk.toFixed(3);
  if (verdict === "ACCEPTABLE") return `Process capable, Cpk = ${cpkText} (>= ${thresholds.acceptable}).`;
  if (verdict === "CONDITIONAL") return `Process marginally capable, Cpk = ${cpkText} (${thresholds.conditional}-${thresholds.acceptable}) — monitor and improve.`;
  return `Process NOT capable, Cpk = ${cpkText} (< ${thresholds.conditional}) — process needs correction.`;
}
