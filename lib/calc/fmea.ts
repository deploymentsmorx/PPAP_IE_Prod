export const SOD_MIN = 1;
export const SOD_MAX = 10;

export function isValidSod(value: number): boolean {
  return Number.isInteger(value) && value >= SOD_MIN && value <= SOD_MAX;
}

/** RPN = Severity × Occurrence × Detection. Shared by DFMEA and PFMEA. */
export function calculateRpn(severity: number, occurrence: number, detection: number): number {
  return severity * occurrence * detection;
}

/** Standard AIAG-style criteria tables, condensed for tooltip display. */
export const SEVERITY_CRITERIA: Record<number, string> = {
  10: "Hazardous — affects safety/regulatory compliance, without warning",
  9: "Hazardous — affects safety/regulatory compliance, with warning",
  8: "Very high — loss of primary function",
  7: "High — primary function performance reduced",
  6: "Moderate — loss of secondary function",
  5: "Low — secondary function performance reduced",
  4: "Very low — fit/finish/squeak/rattle, most customers notice",
  3: "Minor — fit/finish/squeak/rattle, average customers notice",
  2: "Very minor — fit/finish, only discriminating customers notice",
  1: "None — no discernible effect",
};

export const OCCURRENCE_CRITERIA: Record<number, string> = {
  10: "Very high — failure almost inevitable",
  9: "Very high — persistent failures",
  8: "High — frequent failures",
  7: "High — repeated failures",
  6: "Moderate — occasional failures",
  5: "Moderate — moderate number of failures",
  4: "Moderate — relatively few failures",
  3: "Low — few failures",
  2: "Low — very few failures",
  1: "Remote — failure unlikely",
};

export const DETECTION_CRITERIA: Record<number, string> = {
  10: "Absolute uncertainty — no known control to detect",
  9: "Very remote chance of detection",
  8: "Remote chance of detection",
  7: "Very low chance of detection",
  6: "Low chance of detection",
  5: "Moderate chance of detection",
  4: "Moderately high chance of detection",
  3: "High chance of detection",
  2: "Very high chance of detection",
  1: "Almost certain detection",
};
