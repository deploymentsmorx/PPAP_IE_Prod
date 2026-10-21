import { describe, expect, it } from "vitest";
import { auditDiff } from "./audit-diff";

describe("auditDiff", () => {
  it("lists only changed fields, ignoring timestamps", () => {
    expect(
      auditDiff({ status: "PREPARED", remark: "a", updatedAt: "x", id: "1" }, { status: "APPROVED", remark: "a", updatedAt: "y", id: "1" }),
    ).toEqual([{ field: "status", before: "PREPARED", after: "APPROVED" }]);
  });

  it("handles creates and deletes (null side)", () => {
    expect(auditDiff(null, { sampleId: "NBL-001" })).toEqual([{ field: "sampleId", before: "—", after: "NBL-001" }]);
    expect(auditDiff({ sampleId: "NBL-001" }, null)).toEqual([{ field: "sampleId", before: "NBL-001", after: "—" }]);
  });

  it("compares nested values by JSON", () => {
    expect(auditDiff({ reasons: ["A"] }, { reasons: ["A", "B"] })).toEqual([{ field: "reasons", before: '["A"]', after: '["A","B"]' }]);
    expect(auditDiff({ crop: { l: 1 } }, { crop: { l: 1 } })).toEqual([]);
  });
});
