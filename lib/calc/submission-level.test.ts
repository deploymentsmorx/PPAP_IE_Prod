import { describe, expect, it } from "vitest";
import { SUBMISSION_LEVELS, submissionElementNos, submissionLevelErrors } from "./submission-level";

const all = new Set(Array.from({ length: 19 }, (_, n) => n));

describe("submissionElementNos", () => {
  it("level 1 is PSW then AAR", () => {
    expect(submissionElementNos(1, [1, 9], all)).toEqual([18, 13]);
  });

  it("levels 2 and 4 use the picks, PSW first, in element order", () => {
    expect(submissionElementNos(2, [9, 1, 9, 13], all)).toEqual([18, 1, 9, 13]);
    expect(submissionElementNos(4, [17], all)).toEqual([18, 17]);
  });

  it("levels 3 and 5 take every applicable element 0-17", () => {
    expect(submissionElementNos(3, [], all)).toEqual([18, ...Array.from({ length: 18 }, (_, n) => n)]);
    const someNa = new Set([0, 1, 9, 18]);
    expect(submissionElementNos(5, [], someNa)).toEqual([18, 0, 1, 9]);
  });

  it("drops N/A picks and never repeats the PSW", () => {
    expect(submissionElementNos(2, [18, 4, 9], new Set([9, 18]))).toEqual([18, 9]);
    expect(submissionElementNos(1, [], new Set([18]))).toEqual([18]);
  });
});

describe("submissionLevelErrors", () => {
  it("needs a pick for levels 2 and 4 only", () => {
    expect(submissionLevelErrors(2, [])).toHaveLength(1);
    expect(submissionLevelErrors(4, [])).toHaveLength(1);
    expect(submissionLevelErrors(3, [])).toEqual([]);
    expect(submissionLevelErrors(2, [9])).toEqual([]);
  });

  it("rejects unknown levels and out-of-range picks", () => {
    expect(submissionLevelErrors(6, [])).toHaveLength(1);
    expect(submissionLevelErrors(2, [18])).toHaveLength(1);
  });

  it("describes all 5 levels", () => {
    expect(SUBMISSION_LEVELS.map((l) => l.level)).toEqual([1, 2, 3, 4, 5]);
  });
});
