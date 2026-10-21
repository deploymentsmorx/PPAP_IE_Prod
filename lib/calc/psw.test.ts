import { describe, expect, it } from "vitest";
import { PSW_REASONS, pswReadiness, submissionResults, pswSignErrors, pswDeclaration, reasonFromText, type GateElement } from "./psw";

const el = (elementNo: number, status: GateElement["status"], applicability: GateElement["applicability"] = "REQUIRED"): GateElement => ({ elementNo, status, applicability });

describe("PSW_REASONS", () => {
  it("has the sheet's 9 boxes in order", () => {
    expect(PSW_REASONS).toHaveLength(9);
    expect(PSW_REASONS[0].label).toBe("Initial submission");
    expect(PSW_REASONS[8].label).toBe("Parts produced at Additional Location");
  });

  it("maps the PPAP's free-text reason", () => {
    expect(reasonFromText("Initial Submission")).toBe("INITIAL_SUBMISSION");
    expect(reasonFromText(null)).toBeNull();
  });
});

describe("pswReadiness", () => {
  it("lists REQUIRED elements not yet approved, ignoring N/A, RETAIN and the PSW itself", () => {
    const { ready, missing } = pswReadiness([
      el(0, "APPROVED"),
      el(1, "IN_PROGRESS"),
      el(2, "NOT_STARTED", "NA"),
      el(3, "CUSTOMER_APPROVED"),
      el(5, "NOT_STARTED", "RETAIN"),
      el(9, "CHECKED"),
      el(18, "NOT_STARTED"),
    ]);
    expect(ready).toBe(false);
    expect(missing.map((m) => m.elementNo)).toEqual([1, 9]);
  });

  it("is ready once everything required is approved / submitted / customer approved", () => {
    expect(pswReadiness([el(0, "APPROVED"), el(13, "CUSTOMER_APPROVED"), el(14, "SUBMITTED"), el(18, "NOT_STARTED")]).ready).toBe(true);
  });

  it("treats a customer rejection as not done", () => {
    expect(pswReadiness([el(3, "CUSTOMER_REJECTED")]).ready).toBe(false);
  });
});

describe("submissionResults", () => {
  it("ticks each box once its applicable elements are approved", () => {
    const r = submissionResults([el(9, "APPROVED"), el(10, "APPROVED"), el(12, "IN_PROGRESS"), el(13, "CUSTOMER_APPROVED"), el(11, "NOT_STARTED")]);
    expect(r).toEqual({ dimensional: "YES", materialFunctional: "NO", appearance: "YES", statistical: "NO" });
  });

  it("ignores N/A elements, and is NA when all are N/A", () => {
    const r = submissionResults([el(9, "NOT_STARTED", "NA"), el(10, "APPROVED"), el(12, "NOT_STARTED", "NA"), el(13, "NOT_STARTED", "NA"), el(11, "APPROVED")]);
    expect(r).toEqual({ dimensional: "NA", materialFunctional: "YES", appearance: "NA", statistical: "YES" });
  });
});

describe("pswSignErrors", () => {
  const ok = { resultsMeetRequirements: true, explanation: null, printName: "Santhosh BG", title: "Manager QA", reasons: ["INITIAL_SUBMISSION"] };

  it("passes a complete PSW", () => {
    expect(pswSignErrors(ok)).toEqual([]);
  });

  it('requires an explanation when results are "No"', () => {
    expect(pswSignErrors({ ...ok, resultsMeetRequirements: false })).toEqual(['Results answered "No" — an explanation is required.']);
    expect(pswSignErrors({ ...ok, resultsMeetRequirements: false, explanation: "Hole 12 deviation, deviation no. D-01" })).toEqual([]);
  });

  it("requires the Yes/No answer, a reason, name and title", () => {
    expect(pswSignErrors({ resultsMeetRequirements: null, explanation: null, printName: "", title: null, reasons: [] })).toHaveLength(4);
  });
});

describe("pswDeclaration", () => {
  it("fills the production-rate blanks, or leaves the sheet's blanks", () => {
    expect(pswDeclaration("40", "8")).toContain("production rate of 40/ 8 hours");
    expect(pswDeclaration(null, null)).toContain("production rate of ________/ _______ hours");
  });
});
