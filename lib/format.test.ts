import { describe, expect, it } from "vitest";
import { formatDateIndia } from "./format";

describe("formatDateIndia", () => {
  it("formats an ISO date as DD-MM-YYYY", () => {
    expect(formatDateIndia(new Date("2026-01-04T00:00:00.000Z"))).toBe("04-01-2026");
  });

  it("uses the UTC calendar date, not the local one", () => {
    expect(formatDateIndia(new Date("2026-03-16T23:30:00.000Z"))).toBe("16-03-2026");
  });

  it("returns an em dash for null/undefined", () => {
    expect(formatDateIndia(null)).toBe("—");
    expect(formatDateIndia(undefined)).toBe("—");
  });
});
