/**
 * Element 0 (PPAP Checklist) "Required" column ↔ PpapElement.applicability.
 * The column is free text (see CLAUDE.md), so only clearly-worded values
 * sync; anything else (blank, "Retain", "TBD") is left alone rather than
 * guessed at.
 */

export type ChecklistRequired = "REQUIRED" | "NA";

const REQUIRED_WORDS = new Set(["y", "yes", "required", "req"]);
const NA_WORDS = new Set(["n", "no", "na", "n/a", "not required", "not applicable"]);

export function parseChecklistRequired(text: string | null | undefined): ChecklistRequired | null {
  const t = (text ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (REQUIRED_WORDS.has(t)) return "REQUIRED";
  if (NA_WORDS.has(t)) return "NA";
  return null;
}

/** What the checklist's Required cell should say for a page's applicability. */
export function checklistRequiredText(applicability: "REQUIRED" | "RETAIN" | "NA"): string {
  return applicability === "NA" ? "N" : "Y";
}

/**
 * Whether a checklist value disagrees with a page's applicability. RETAIN
 * counts as required ("Y") — it's still produced, just kept at the supplier.
 */
export function checklistDisagrees(parsed: ChecklistRequired, applicability: "REQUIRED" | "RETAIN" | "NA"): boolean {
  return parsed === "NA" ? applicability !== "NA" : applicability === "NA";
}
