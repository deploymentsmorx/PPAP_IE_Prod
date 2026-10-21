/**
 * Element 15 (Master Sample) calculations: expiry = approval date +
 * retention period, the 30-day expiry reminder, and parsing the reference
 * sheet's free-text cells ("3Years", "Active").
 */

export const EXPIRY_REMINDER_DAYS = 30;

/**
 * Approval date + whole years, on the UTC calendar (dates are stored as
 * UTC midnight). A 29-Feb approval expires on 28-Feb in a non-leap year
 * rather than rolling into March.
 */
export function masterSampleExpiry(approvalDate: Date | null, retentionYears: number | null): Date | null {
  if (!approvalDate || retentionYears == null) return null;
  const y = approvalDate.getUTCFullYear() + retentionYears;
  const m = approvalDate.getUTCMonth();
  const lastDayOfMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const d = Math.min(approvalDate.getUTCDate(), lastDayOfMonth);
  return new Date(Date.UTC(y, m, d));
}

export type ExpiryState = "EXPIRED" | "EXPIRING_SOON" | "OK";

/** Whole days from today (UTC calendar) until the expiry date; negative once past. */
export function daysUntil(expiry: Date, today: Date = new Date()): number {
  const startOfToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const startOfExpiry = Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate());
  return Math.round((startOfExpiry - startOfToday) / 86_400_000);
}

/**
 * Reminder state: EXPIRING_SOON from 30 days ahead (inclusive) up to and
 * including the expiry day itself; EXPIRED the day after.
 */
export function expiryState(expiry: Date | null, today: Date = new Date()): ExpiryState | null {
  if (!expiry) return null;
  const days = daysUntil(expiry, today);
  if (days < 0) return "EXPIRED";
  if (days <= EXPIRY_REMINDER_DAYS) return "EXPIRING_SOON";
  return "OK";
}

/** Sheet's "Retention Period" cell: "3Years", "3 years", "3 Yrs", 3 → 3. */
export function parseRetentionYears(text: string | number | null | undefined): number | null {
  if (text == null) return null;
  if (typeof text === "number") return Number.isFinite(text) ? Math.trunc(text) : null;
  const match = /^\s*(\d+)\s*(y(ea)?rs?|y)?\s*$/i.exec(text);
  return match ? Number(match[1]) : null;
}

/** Sheet's "Status" cell → MasterSampleStatus; unknown text defaults to ACTIVE. */
export function parseMasterSampleStatus(text: string | null | undefined): "ACTIVE" | "SUPERSEDED" | "DISPOSED" {
  const t = (text ?? "").trim().toLowerCase();
  if (t.startsWith("supersed")) return "SUPERSEDED";
  if (t.startsWith("dispos")) return "DISPOSED";
  return "ACTIVE";
}

/** Next free "<PROJECT>-NNN" ID, matching the sheet's "NBL-001". */
export function nextMasterSampleId(prefix: string, existing: string[]): string {
  const taken = new Set(existing);
  for (let n = 1; ; n++) {
    const candidate = `${prefix}-${String(n).padStart(3, "0")}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Text encoded in a master sample's QR tag. */
export function masterSampleTagPayload(tag: {
  sampleId: string;
  partNumber: string;
  revision: string;
  approvalDate: string | null;
  expiry: string | null;
  location: string | null;
}): string {
  return [
    `Master sample: ${tag.sampleId}`,
    `Part: ${tag.partNumber}`,
    `Rev: ${tag.revision}`,
    `Approved: ${tag.approvalDate ?? "-"}`,
    `Expiry: ${tag.expiry ?? "-"}`,
    `Location: ${tag.location ?? "-"}`,
  ].join("\n");
}
