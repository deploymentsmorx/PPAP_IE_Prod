import { describe, expect, it } from "vitest";
import { canUserEditDisposition } from "./customer-disposition-permission";

describe("canUserEditDisposition", () => {
  it("lets any user edit in supplier-upload mode, even with no session", () => {
    expect(canUserEditDisposition(null, { approvalMode: "SUPPLIER_UPLOAD", customerId: "cust-1" })).toBe(true);
  });

  it("blocks an unauthenticated user in customer-portal mode", () => {
    expect(canUserEditDisposition(null, { approvalMode: "CUSTOMER_PORTAL", customerId: "cust-1" })).toBe(false);
  });

  it("blocks a supplier user with no CUSTOMER_APPROVER role in portal mode", () => {
    const user = { roles: ["QA_ENGINEER"], customerId: null };
    expect(canUserEditDisposition(user, { approvalMode: "CUSTOMER_PORTAL", customerId: "cust-1" })).toBe(false);
  });

  it("blocks a CUSTOMER_APPROVER tied to a different customer", () => {
    const user = { roles: ["CUSTOMER_APPROVER"], customerId: "cust-2" };
    expect(canUserEditDisposition(user, { approvalMode: "CUSTOMER_PORTAL", customerId: "cust-1" })).toBe(false);
  });

  it("allows a CUSTOMER_APPROVER tied to the matching customer", () => {
    const user = { roles: ["CUSTOMER_APPROVER"], customerId: "cust-1" };
    expect(canUserEditDisposition(user, { approvalMode: "CUSTOMER_PORTAL", customerId: "cust-1" })).toBe(true);
  });
});
