/**
 * Pure decision logic for whether a user may edit a PPAP element's
 * customer disposition, given the PPAP's approval mode. Separated from
 * lib/actions/customer-disposition.ts so it's testable without a request
 * context (the action wraps this with the actual session/user lookup).
 */
export function canUserEditDisposition(
  user: { roles: string[]; customerId: string | null } | null,
  ppap: { approvalMode: "CUSTOMER_PORTAL" | "SUPPLIER_UPLOAD"; customerId: string },
): boolean {
  if (ppap.approvalMode === "SUPPLIER_UPLOAD") return true;
  if (!user) return false;
  return user.roles.includes("CUSTOMER_APPROVER") && user.customerId === ppap.customerId;
}
