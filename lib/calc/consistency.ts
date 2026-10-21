/**
 * Pre-submission data-consistency checks (run before the PSW is signed and
 * shown on the PSW / pack pages). Pure rules over plain data; the DB
 * gathering is lib/consistency.ts. ERROR blocks signing the PSW; WARNING is
 * shown for review only.
 */

export type Severity = "ERROR" | "WARNING";
export type Issue = { severity: Severity; elementNo: number | null; check: string; message: string };

const day = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/**
 * Date order per element: prepared ≤ checked ≤ approved ≤ PSW date (the
 * PSW signature date, or today when it isn't signed yet). Compared by
 * calendar day.
 */
export function checkDateOrder(
  elements: { elementNo: number; preparedAt: Date | null; checkedAt: Date | null; approvedAt: Date | null }[],
  pswDate: Date,
): Issue[] {
  const issues: Issue[] = [];
  for (const e of elements) {
    if (e.elementNo === 18) continue;
    const chain: [string, Date | null][] = [
      ["prepared", e.preparedAt],
      ["checked", e.checkedAt],
      ["approved", e.approvedAt],
    ];
    const present = chain.filter((c): c is [string, Date] => c[1] !== null);
    for (let i = 1; i < present.length; i++) {
      if (day(present[i][1]) < day(present[i - 1][1])) {
        issues.push({ severity: "ERROR", elementNo: e.elementNo, check: "Date order", message: `${cap(present[i][0])} date is before the ${present[i - 1][0]} date.` });
      }
    }
    const last = present.at(-1);
    if (last && day(last[1]) > day(pswDate)) {
      issues.push({ severity: "ERROR", elementNo: e.elementNo, check: "Date order", message: `${cap(last[0])} date is after the PSW date.` });
    }
  }
  return issues;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Records that point at data of another PPAP (e.g. an SPC study on another revision's characteristic). */
export function checkOwnership(foreign: { elementNo: number; what: string; count: number }[]): Issue[] {
  return foreign
    .filter((f) => f.count > 0)
    .map((f) => ({ severity: "ERROR" as const, elementNo: f.elementNo, check: "Part revision", message: `${f.count} ${f.what} belong to a different part revision / PPAP.` }));
}

/**
 * Checklist "Required" vs the pages: an N/A page that nevertheless has data,
 * and a required page with no data at all.
 */
export function checkApplicability(elements: { elementNo: number; applicability: "REQUIRED" | "RETAIN" | "NA"; hasData: boolean; checklistRequired: string | null }[]): Issue[] {
  const issues: Issue[] = [];
  for (const e of elements) {
    if (e.elementNo === 0 || e.elementNo === 18) continue;
    const said = e.checklistRequired?.trim().toUpperCase();
    if (said === "N" && e.applicability !== "NA") {
      issues.push({ severity: "WARNING", elementNo: e.elementNo, check: "Checklist vs page", message: 'Checklist says "N" but the page is required.' });
    }
    if (e.applicability === "NA" && e.hasData) {
      issues.push({ severity: "WARNING", elementNo: e.elementNo, check: "Checklist vs page", message: "Page is N/A but contains data." });
    }
    if (e.applicability === "REQUIRED" && !e.hasData) {
      issues.push({ severity: "WARNING", elementNo: e.elementNo, check: "Checklist vs page", message: "Page is required but has no data." });
    }
  }
  return issues;
}

/** Typed values that disagree with the computed ones. */
export function checkTypedValues(input: {
  pfmeaApMismatches: number;
  checklistStatusOk: { elementNo: number; approved: boolean }[];
  dimensionalRemarkMismatches: number;
  pswSaysMeets: boolean | null;
  resultsAllTicked: boolean;
  dimensionalNg: number;
}): Issue[] {
  const issues: Issue[] = [];
  if (input.pfmeaApMismatches > 0) {
    issues.push({ severity: "WARNING", elementNo: 6, check: "Typed vs computed", message: `${input.pfmeaApMismatches} PFMEA row(s) have a typed Action Priority that differs from the computed one.` });
  }
  for (const c of input.checklistStatusOk.filter((c) => !c.approved)) {
    issues.push({ severity: "WARNING", elementNo: c.elementNo, check: "Typed vs computed", message: 'Checklist status says "OK" but the page is not approved.' });
  }
  if (input.dimensionalRemarkMismatches > 0) {
    issues.push({ severity: "WARNING", elementNo: 9, check: "Typed vs computed", message: `${input.dimensionalRemarkMismatches} dimensional row(s) have a typed OK/NG remark that differs from the measured status.` });
  }
  if (input.pswSaysMeets === true && (input.dimensionalNg > 0 || !input.resultsAllTicked)) {
    issues.push({
      severity: "ERROR",
      elementNo: 18,
      check: "Typed vs computed",
      message:
        input.dimensionalNg > 0
          ? `PSW says results meet all requirements, but ${input.dimensionalNg} dimension(s) are NG.`
          : "PSW says results meet all requirements, but not every submission-results box is complete.",
    });
  }
  return issues;
}

export function summarize(issues: Issue[]) {
  return { errors: issues.filter((i) => i.severity === "ERROR").length, warnings: issues.filter((i) => i.severity === "WARNING").length };
}
