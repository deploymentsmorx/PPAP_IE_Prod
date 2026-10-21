/**
 * Final PPAP submission by AIAG level (pack page): which sheets go into the
 * final PDF. The PSW (element 18) is always sheet 1; the rest follow in
 * element order. Levels 2 and 4 use the supporting documents the user
 * picked; levels 1, 3 and 5 are fixed. N/A elements are never included.
 */

export const PSW_ELEMENT_NO = 18;
export const AAR_ELEMENT_NO = 13;

/** Supporting documents that can go after the PSW: the checklist cover and elements 1-17. */
export const SUPPORTING_ELEMENT_NOS = Array.from({ length: 18 }, (_, n) => n);

export type SubmissionLevel = {
  level: number;
  title: string;
  description: string;
  /** Product samples are sent with the submission (physical parts — not part of the PDF). */
  productSample: boolean;
  /** The user picks which supporting documents go in. */
  picks: boolean;
};

export const SUBMISSION_LEVELS: SubmissionLevel[] = [
  { level: 1, title: "PSW + AAR", description: "Part Submission Warrant and the Appearance Approval Report only.", productSample: false, picks: false },
  {
    level: 2,
    title: "PSW + product sample + limited supporting documents",
    description: "Warrant with product samples and the supporting documents you choose below.",
    productSample: true,
    picks: true,
  },
  {
    level: 3,
    title: "PSW + product sample + complete supporting documents",
    description: "Warrant with product samples and every applicable supporting document.",
    productSample: true,
    picks: false,
  },
  {
    level: 4,
    title: "PSW + customer-specific supporting documents",
    description: "Warrant and the supporting documents the customer has asked for — choose them below.",
    productSample: false,
    picks: true,
  },
  {
    level: 5,
    title: "PSW + product sample + complete supporting data, reviewed at supplier's facility",
    description: "Warrant with product samples and every applicable supporting document, reviewed at the supplier's manufacturing location.",
    productSample: true,
    picks: false,
  },
];

export const submissionLevel = (level: number) => SUBMISSION_LEVELS.find((l) => l.level === level);

/** Element numbers for the final PDF, PSW first, then the level's supporting documents in element order. */
export function submissionElementNos(level: number, picks: readonly number[], applicable: ReadonlySet<number>): number[] {
  const def = submissionLevel(level);
  if (!def) return [PSW_ELEMENT_NO];
  const rest = level === 1 ? [AAR_ELEMENT_NO] : def.picks ? picks : SUPPORTING_ELEMENT_NOS;
  const supporting = [...new Set(rest)].filter((n) => SUPPORTING_ELEMENT_NOS.includes(n) && applicable.has(n)).sort((a, b) => a - b);
  return [PSW_ELEMENT_NO, ...supporting];
}

/** Why a level choice can't be saved (empty = OK). */
export function submissionLevelErrors(level: number, picks: readonly number[]): string[] {
  const def = submissionLevel(level);
  if (!def) return ["Choose a submission level from 1 to 5."];
  if (def.picks && picks.length === 0) return [`Level ${level} needs at least one supporting document — tick the ones to include.`];
  if (picks.some((n) => !SUPPORTING_ELEMENT_NOS.includes(n))) return ["Supporting documents must be elements 0-17 (the PSW is always included)."];
  return [];
}
