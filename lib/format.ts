/**
 * Dates are stored as ISO/UTC in the database and displayed DD-MM-YYYY
 * (India) in the UI, per CLAUDE.md.
 */
export function formatDateIndia(date: Date | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getUTCFullYear()}`;
}
