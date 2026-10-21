import { describe, expect, it } from "vitest";
import { permissionsFor, isCustomerOnly } from "./permissions";

describe("permissionsFor", () => {
  it("lets an admin do everything", () => {
    expect(permissionsFor(["ADMIN"])).toEqual({ editSupplierData: true, approvePages: true, signPsw: true, viewAuditLog: true, manageUsers: true, ownCustomerOnly: false });
  });

  it("lets a QA manager approve and sign, but not manage users", () => {
    expect(permissionsFor(["QA_MANAGER"])).toMatchObject({ approvePages: true, signPsw: true, viewAuditLog: true, manageUsers: false });
  });

  it("lets engineers and role-less users edit but not approve or sign", () => {
    for (const roles of [["QA_ENGINEER"], ["ENGINEERING"], ["PRODUCTION"], []]) {
      expect(permissionsFor(roles)).toMatchObject({ editSupplierData: true, approvePages: false, signPsw: false, ownCustomerOnly: false });
    }
  });

  it("confines a customer approver to its own customer, read-only", () => {
    expect(permissionsFor(["CUSTOMER_APPROVER"])).toEqual({ editSupplierData: false, approvePages: false, signPsw: false, viewAuditLog: false, manageUsers: false, ownCustomerOnly: true });
  });

  it("treats a customer approver who also has a supplier role as a supplier user", () => {
    expect(isCustomerOnly(["CUSTOMER_APPROVER", "QA_ENGINEER"])).toBe(false);
    expect(permissionsFor(["CUSTOMER_APPROVER", "QA_MANAGER"])).toMatchObject({ editSupplierData: true, ownCustomerOnly: false });
  });
});
