import { describe, expect, it } from "vitest";
import { checkDateOrder, checkOwnership, checkApplicability, checkTypedValues, summarize } from "./consistency";

const d = (iso: string) => new Date(`${iso}T09:00:00.000Z`);

describe("checkDateOrder", () => {
  it("passes prepared ≤ checked ≤ approved ≤ PSW date, same day included", () => {
    expect(checkDateOrder([{ elementNo: 9, preparedAt: d("2026-01-04"), checkedAt: d("2026-01-04"), approvedAt: d("2026-02-01") }], d("2026-02-01"))).toEqual([]);
  });

  it("flags a check before preparation and an approval after the PSW date", () => {
    const issues = checkDateOrder(
      [
        { elementNo: 7, preparedAt: d("2026-03-01"), checkedAt: d("2026-02-01"), approvedAt: null },
        { elementNo: 9, preparedAt: d("2026-01-04"), checkedAt: null, approvedAt: d("2026-05-01") },
      ],
      d("2026-04-01"),
    );
    expect(issues.map((i) => [i.elementNo, i.message])).toEqual([
      [7, "Checked date is before the prepared date."],
      [9, "Approved date is after the PSW date."],
    ]);
    expect(issues.every((i) => i.severity === "ERROR")).toBe(true);
  });

  it("ignores missing stages and the PSW element itself", () => {
    expect(checkDateOrder([{ elementNo: 18, preparedAt: d("2027-01-01"), checkedAt: null, approvedAt: null }], d("2026-01-01"))).toEqual([]);
    expect(checkDateOrder([{ elementNo: 3, preparedAt: null, checkedAt: null, approvedAt: null }], d("2026-01-01"))).toEqual([]);
  });
});

describe("checkOwnership", () => {
  it("errors only for non-zero foreign references", () => {
    const issues = checkOwnership([
      { elementNo: 11, what: "SPC studies", count: 2 },
      { elementNo: 8, what: "MSA studies", count: 0 },
    ]);
    expect(issues).toEqual([{ severity: "ERROR", elementNo: 11, check: "Part revision", message: "2 SPC studies belong to a different part revision / PPAP." }]);
  });
});

describe("checkApplicability", () => {
  it("warns on checklist N vs required page, N/A page with data, required page without data", () => {
    const issues = checkApplicability([
      { elementNo: 2, applicability: "REQUIRED", hasData: false, checklistRequired: "N" },
      { elementNo: 4, applicability: "NA", hasData: true, checklistRequired: "N" },
      { elementNo: 9, applicability: "REQUIRED", hasData: true, checklistRequired: "Y" },
    ]);
    expect(issues.map((i) => [i.elementNo, i.message])).toEqual([
      [2, 'Checklist says "N" but the page is required.'],
      [2, "Page is required but has no data."],
      [4, "Page is N/A but contains data."],
    ]);
  });
});

describe("checkTypedValues", () => {
  const ok = { pfmeaApMismatches: 0, checklistStatusOk: [], dimensionalRemarkMismatches: 0, pswSaysMeets: true, resultsAllTicked: true, dimensionalNg: 0 };

  it("passes when typed and computed agree", () => {
    expect(checkTypedValues(ok)).toEqual([]);
  });

  it("errors when the PSW claims conformance with NG dimensions", () => {
    const [issue] = checkTypedValues({ ...ok, dimensionalNg: 3 });
    expect(issue).toMatchObject({ severity: "ERROR", elementNo: 18, message: "PSW says results meet all requirements, but 3 dimension(s) are NG." });
  });

  it("warns on typed AP / checklist OK / dimensional remark disagreements", () => {
    const issues = checkTypedValues({ ...ok, pfmeaApMismatches: 4, checklistStatusOk: [{ elementNo: 8, approved: false }], dimensionalRemarkMismatches: 1 });
    expect(issues.map((i) => i.elementNo)).toEqual([6, 8, 9]);
    expect(summarize(issues)).toEqual({ errors: 0, warnings: 3 });
  });
});
