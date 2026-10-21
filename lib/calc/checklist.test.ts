import { describe, expect, it } from "vitest";
import { parseChecklistRequired, checklistRequiredText, checklistDisagrees } from "./checklist";

describe("parseChecklistRequired", () => {
  it("reads the seeded Y / N values", () => {
    expect(parseChecklistRequired("Y")).toBe("REQUIRED");
    expect(parseChecklistRequired("N")).toBe("NA");
  });

  it("accepts common spellings, case- and space-insensitive", () => {
    expect(parseChecklistRequired(" yes ")).toBe("REQUIRED");
    expect(parseChecklistRequired("Required")).toBe("REQUIRED");
    expect(parseChecklistRequired("N/A")).toBe("NA");
    expect(parseChecklistRequired("NA")).toBe("NA");
    expect(parseChecklistRequired("No.")).toBe("NA");
    expect(parseChecklistRequired("Not Required")).toBe("NA");
  });

  it("leaves blank or unclear text unsynced", () => {
    expect(parseChecklistRequired("")).toBeNull();
    expect(parseChecklistRequired(null)).toBeNull();
    expect(parseChecklistRequired("Retain")).toBeNull();
    expect(parseChecklistRequired("TBD")).toBeNull();
  });
});

describe("checklistRequiredText / checklistDisagrees", () => {
  it("writes N for N/A and Y otherwise", () => {
    expect(checklistRequiredText("NA")).toBe("N");
    expect(checklistRequiredText("REQUIRED")).toBe("Y");
    expect(checklistRequiredText("RETAIN")).toBe("Y");
  });

  it("treats RETAIN as agreeing with Y", () => {
    expect(checklistDisagrees("REQUIRED", "RETAIN")).toBe(false);
    expect(checklistDisagrees("REQUIRED", "NA")).toBe(true);
    expect(checklistDisagrees("NA", "RETAIN")).toBe(true);
    expect(checklistDisagrees("NA", "NA")).toBe(false);
  });
});
