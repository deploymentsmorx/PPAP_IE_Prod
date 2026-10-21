import { describe, expect, it } from "vitest";
import { calculateRpn, isValidSod, SOD_MIN, SOD_MAX } from "./fmea";

describe("calculateRpn", () => {
  it("multiplies severity, occurrence, and detection", () => {
    expect(calculateRpn(9, 5, 2)).toBe(90);
  });

  it("handles the minimum (1,1,1) and maximum (10,10,10) bounds", () => {
    expect(calculateRpn(1, 1, 1)).toBe(1);
    expect(calculateRpn(10, 10, 10)).toBe(1000);
  });

  it("matches the PFMEA sample from the source workbook (S9 O5 D2)", () => {
    expect(calculateRpn(9, 5, 2)).toBe(90);
  });
});

describe("isValidSod", () => {
  it("accepts integers within 1-10", () => {
    expect(isValidSod(1)).toBe(true);
    expect(isValidSod(10)).toBe(true);
    expect(isValidSod(5)).toBe(true);
  });

  it("rejects out-of-range or non-integer values", () => {
    expect(isValidSod(0)).toBe(false);
    expect(isValidSod(11)).toBe(false);
    expect(isValidSod(5.5)).toBe(false);
  });

  it("stays consistent with the exported bounds", () => {
    expect(isValidSod(SOD_MIN)).toBe(true);
    expect(isValidSod(SOD_MAX)).toBe(true);
  });
});
