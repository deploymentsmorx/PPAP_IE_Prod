/**
 * Role → permission matrix (pure; enforced by lib/permissions.ts).
 *
 *  SUPER_ADMIN        all PPAP and user permissions plus license management
 *  ADMIN              everything in the licensed workspace, incl. user management
 *  QA_MANAGER         edit, approve pages, sign the PSW, audit log
 *  LEAD               edit and approve pages, but cannot sign PSW or manage users
 *  QA_ENGINEER /
 *  ENGINEERING /
 *  PRODUCTION / none  edit pages, prepare & check — not approve or sign
 *  CUSTOMER_APPROVER  (with no supplier role) read-only on its own
 *                     customer's PPAPs + customer dispositions (portal)
 */

export type Role = "SUPER_ADMIN" | "ADMIN" | "LEAD" | "QA_ENGINEER" | "QA_MANAGER" | "ENGINEERING" | "PRODUCTION" | "CUSTOMER_APPROVER";

const SUPPLIER_ROLES: ReadonlySet<string> = new Set(["SUPER_ADMIN", "ADMIN", "LEAD", "QA_ENGINEER", "QA_MANAGER", "ENGINEERING", "PRODUCTION"]);

/** A customer's approver login with no supplier role — confined to its own customer, read-only. */
export function isCustomerOnly(roles: readonly string[]): boolean {
  return roles.includes("CUSTOMER_APPROVER") && !roles.some((r) => SUPPLIER_ROLES.has(r));
}

export function permissionsFor(roles: readonly string[]) {
  const customerOnly = isCustomerOnly(roles);
  const superAdmin = roles.includes("SUPER_ADMIN");
  const admin = superAdmin || roles.includes("ADMIN");
  const manager = admin || roles.includes("QA_MANAGER");
  const lead = roles.includes("LEAD");
  return {
    /** Edit any supplier page / master data (instruments, labs, CSR, clone, new PPAP). */
    editSupplierData: !customerOnly,
    /** Be named as "Approved by" on a page. */
    approvePages: manager || lead,
    /** E-sign the PSW. */
    signPsw: manager,
    viewAuditLog: manager,
    manageUsers: admin,
    /** Create and manage customer licenses and their initial accounts. */
    manageLicenses: superAdmin,
    /** Restricted to PPAPs of its own customer. */
    ownCustomerOnly: customerOnly,
  };
}
