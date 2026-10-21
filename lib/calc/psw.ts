/**
 * Element 18 (PSW) pure helpers: the sheet's fixed texts, the readiness
 * gate, the auto-ticked submission results, and pre-sign validation.
 */

/** The 9 "Reason for submission" boxes, in the sheet's order (left column, then right). */
export const PSW_REASONS = [
  { code: "INITIAL_SUBMISSION", label: "Initial submission" },
  { code: "ENGINEERING_CHANGES", label: "Engineering Change(s)" },
  { code: "TOOLING", label: "Tooling: Transfer, Replacement, Refurbishment, or additional" },
  { code: "CORRECTION_OF_DISCREPANCY", label: "Correction of Discrepancy" },
  { code: "OTHER", label: "Other-please specify" },
  { code: "OPTIONAL_CONSTRUCTION", label: "Change to Optional Construction or Material" },
  { code: "SUB_SUPPLIER_CHANGE", label: "Sub-Supplier or Material Source Change" },
  { code: "PART_PROCESSING_CHANGE", label: "Change in Part Processing" },
  { code: "ADDITIONAL_LOCATION", label: "Parts produced at Additional Location" },
] as const;
export type PswReasonCode = (typeof PSW_REASONS)[number]["code"];

export const PSW_LEVELS: Record<number, string> = {
  1: "Level 1 - Warrant Only Submitted to Customer",
  2: "Level 2 - Warrant, Parts, Drawings, Inspection Results, Laboratory and Functional Results, Appearance Approval Report",
  3: "Level 3 - Warrant with Product Samples and complete supporting data submitted to customer",
  4: "Level 4 - Warrant and Other Requirements as defined by Customer",
  5: "Level 5 - Warrant with Product Samples and Complete Supporting Data Reviewed at Supplier's Manufacturing Location",
};

/** Declaration text, verbatim; the production-rate blanks are filled from the PSW. */
export function pswDeclaration(rateQty: string | null, rateHours: string | null): string {
  return (
    "I affirm that the samples represented by this warrant are representative of our parts and have been made to the applicable customer " +
    "drawings and specifications and are made from specified materials on regular production tooling with no operations other than the " +
    `regular production process. I further affirm that these samples were produced at the production rate of ${rateQty || "________"}/ ${rateHours || "_______"} hours. ` +
    "I have noted any deviations from this declaration below."
  );
}

/** Legacy free text on Ppap.reasonForSubmission ("Initial Submission") → reason code, for defaults. */
export function reasonFromText(text: string | null | undefined): PswReasonCode | null {
  const t = (text ?? "").toLowerCase();
  if (t.includes("initial")) return "INITIAL_SUBMISSION";
  if (t.includes("engineering")) return "ENGINEERING_CHANGES";
  if (t.includes("tool")) return "TOOLING";
  return null;
}

type Status = "NOT_STARTED" | "IN_PROGRESS" | "PREPARED" | "CHECKED" | "APPROVED" | "SUBMITTED" | "CUSTOMER_APPROVED" | "CUSTOMER_REJECTED";
type Applicability = "REQUIRED" | "RETAIN" | "NA";
export type GateElement = { elementNo: number; status: Status; applicability: Applicability };

const DONE: ReadonlySet<Status> = new Set(["APPROVED", "SUBMITTED", "CUSTOMER_APPROVED"]);

/**
 * Readiness gate: the PSW can be signed only once every REQUIRED element
 * (0-17 — the PSW itself is what's being signed) is approved. Returns the
 * ones still missing, in element order.
 */
export function pswReadiness(elements: GateElement[]): { ready: boolean; missing: GateElement[] } {
  const missing = elements
    .filter((e) => e.elementNo !== 18 && e.applicability === "REQUIRED" && !DONE.has(e.status))
    .sort((a, b) => a.elementNo - b.elementNo);
  return { ready: missing.length === 0, missing };
}

export type ResultTick = "YES" | "NO" | "NA";

/** Which elements back each "Submission results" box. */
export const RESULT_SOURCES = {
  dimensional: [9],
  materialFunctional: [10, 12],
  appearance: [13],
  statistical: [11],
} as const;

/**
 * A results box is ticked once every applicable (non-N/A) element behind
 * it is approved; "NA" when all of them are N/A.
 */
export function submissionResults(elements: GateElement[]): Record<keyof typeof RESULT_SOURCES, ResultTick> {
  const out = {} as Record<keyof typeof RESULT_SOURCES, ResultTick>;
  for (const [key, nos] of Object.entries(RESULT_SOURCES) as [keyof typeof RESULT_SOURCES, readonly number[]][]) {
    const applicable = elements.filter((e) => nos.includes(e.elementNo) && e.applicability !== "NA");
    out[key] = applicable.length === 0 ? "NA" : applicable.every((e) => DONE.has(e.status)) ? "YES" : "NO";
  }
  return out;
}

/** What still has to be filled in before the PSW can be signed (besides the gate). */
export function pswSignErrors(d: { resultsMeetRequirements: boolean | null; explanation: string | null; printName: string | null; title: string | null; reasons: string[] }): string[] {
  const errors: string[] = [];
  if (d.reasons.length === 0) errors.push("Tick at least one reason for submission.");
  if (d.resultsMeetRequirements === null) errors.push('Answer "These results meet all drawing and specification requirements" (Yes/No).');
  if (d.resultsMeetRequirements === false && !d.explanation?.trim()) errors.push('Results answered "No" — an explanation is required.');
  if (!d.printName?.trim()) errors.push("Print name is required.");
  if (!d.title?.trim()) errors.push("Title is required.");
  return errors;
}
