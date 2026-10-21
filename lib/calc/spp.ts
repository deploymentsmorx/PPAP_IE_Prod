/**
 * Element 14 (Sample Production Part) pure helpers. The page is mostly a
 * read-only roll-up of other pages; these turn their data into the sheet's
 * short answers ("Completed / Pending", "Attached / Verified", ...).
 */

export type ElementStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "PREPARED"
  | "CHECKED"
  | "APPROVED"
  | "SUBMITTED"
  | "CUSTOMER_APPROVED"
  | "CUSTOMER_REJECTED";

const STATUS_LABEL: Record<ElementStatus, string> = {
  NOT_STARTED: "not started",
  IN_PROGRESS: "in progress",
  PREPARED: "prepared",
  CHECKED: "checked",
  APPROVED: "approved",
  SUBMITTED: "submitted",
  CUSTOMER_APPROVED: "customer approved",
  CUSTOMER_REJECTED: "customer rejected",
};

const DONE: ReadonlySet<ElementStatus> = new Set(["APPROVED", "SUBMITTED", "CUSTOMER_APPROVED"]);

/** Sheet's "Completed / Pending" for another page, e.g. PFMEA Status. */
export function completionText(status: ElementStatus, applicability: "REQUIRED" | "RETAIN" | "NA"): string {
  if (applicability === "NA") return "N/A";
  return DONE.has(status) ? "Completed" : `Pending (${STATUS_LABEL[status]})`;
}

/**
 * Operations the sheet calls "Special Processes (Welding / Heat Treatment /
 * Coating etc.)" — process steps whose quality can't be fully verified by
 * later inspection.
 */
const SPECIAL_PROCESS_PATTERN = /weld|heat[\s-]*treat|harden|temper|anneal|coat|paint|plat|galvan|powder|blast|phosphat/i;

export function specialProcesses(stepNames: string[]): string[] {
  return stepNames.filter((name) => SPECIAL_PROCESS_PATTERN.test(name));
}

export type ResultStatus = "OK" | "NG" | "UNKNOWN";

/**
 * Sheet's "Chemical Composition / Mechanical Properties: Attached /
 * Verified" from element 12 statuses: "Verified — 9 OK", "2 NG (Mn, C)",
 * or "Not yet tested" when nothing has a judgeable result.
 */
export function summarizeLabStatuses(items: { label: string; status: ResultStatus }[]): string {
  const ng = items.filter((i) => i.status === "NG");
  const ok = items.filter((i) => i.status === "OK");
  if (ng.length > 0) return `${ng.length} NG (${ng.map((i) => i.label).join(", ")})`;
  if (ok.length > 0) return `Verified — ${ok.length} OK`;
  return "Not yet tested";
}

/**
 * "Key rows" for section 4: every NG row first (they matter most), then
 * OK rows, then not-yet-measured rows (still useful: dimension, spec and
 * instrument), each group in sheet order, up to `limit`.
 */
export function pickKeyDimensionalRows<T extends { status: ResultStatus }>(rows: T[], limit = 10): T[] {
  const ng = rows.filter((r) => r.status === "NG");
  const ok = rows.filter((r) => r.status === "OK");
  const unmeasured = rows.filter((r) => r.status === "UNKNOWN");
  return [...ng, ...ok, ...unmeasured].slice(0, limit);
}

/** Sheet's GRR Status cell from an MSA verdict / %GRR, or why there's none. */
export function grrStatusText(study: { pctGrr: number; verdict: "ACCEPTABLE" | "CONDITIONALLY_ACCEPTABLE" | "NOT_ACCEPTABLE" } | "INCOMPLETE" | null): string {
  if (study === null) return "No MSA study";
  if (study === "INCOMPLETE") return "Study incomplete";
  const label = { ACCEPTABLE: "Acceptable", CONDITIONALLY_ACCEPTABLE: "Conditionally acceptable", NOT_ACCEPTABLE: "Not acceptable" }[study.verdict];
  return `${study.pctGrr.toFixed(1)}% — ${label}`;
}

/** Section 10's fixed text, exactly as on the sheet. */
export const SPP_DECLARATION_TEXT =
  "We hereby confirm that the samples submitted are manufactured using production tooling, processes, and meet all drawing and specification requirements.";

/** Text encoded in a sample tag's QR code. */
export function sampleTagPayload(tag: { sampleId: string; partNumber: string; revision: string; date: string | null }): string {
  return [`Sample: ${tag.sampleId}`, `Part: ${tag.partNumber}`, `Rev: ${tag.revision}`, `Date: ${tag.date ?? "-"}`].join("\n");
}
