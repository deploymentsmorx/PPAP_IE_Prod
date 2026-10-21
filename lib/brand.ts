const LEGACY_COMPANY_NAMES = new Set([
  "ingenious engineering",
  "ingenious engineering pvt ltd",
  "ingenious engineering pvt. ltd.",
]);

export const COMPANY_NAME = "Smorx";

/** Display the current company name when an existing supplier record uses the former brand. */
export function displayCompanyName(name?: string | null) {
  const value = name?.trim();
  return !value || LEGACY_COMPANY_NAMES.has(value.toLowerCase()) ? COMPANY_NAME : value;
}
