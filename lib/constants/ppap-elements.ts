/**
 * The 19 rows of a PPAP (elementNo 0 = checklist cover, 1-18 = the AIAG
 * elements; element 11 covers both SPC sheets as one logical element).
 * Used by the seed script and by the nav/UI so labels stay in one place.
 */
export const PPAP_ELEMENT_NAMES: Record<number, string> = {
  0: "PPAP Checklist",
  1: "Design Records",
  2: "Authorized Engineering Change Documents",
  3: "Customer Engineering Approval",
  4: "Design FMEA (DFMEA)",
  5: "Process Flow Diagram",
  6: "Process FMEA (PFMEA)",
  7: "Control Plan",
  8: "Measurement System Analysis (MSA)",
  9: "Dimensional Results",
  10: "Material, Performance and Functional Test Results",
  11: "Initial Process Studies",
  12: "Qualified Laboratory Documentation",
  13: "Appearance Approval Report (AAR)",
  14: "Sample Production Parts",
  15: "Master Sample",
  16: "Checking Aids",
  17: "Customer-Specific Requirements",
  18: "Part Submission Warrant (PSW)",
};

/**
 * Elements whose source sheet is portrait (ECN, CEA, Dimensional Report,
 * LAB Report, AAR, Sample Production Part, Master Sample, Checking Aids,
 * CSR, PSW); every other print layout is landscape.
 */
export const PORTRAIT_ELEMENT_NOS: ReadonlySet<number> = new Set([2, 3, 9, 12, 13, 14, 15, 16, 17, 18]);

export const PPAP_ELEMENT_NUMBERS =Object.keys(PPAP_ELEMENT_NAMES).map(Number).sort((a, b) => a - b);
