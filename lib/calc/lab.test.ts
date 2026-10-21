import { describe, expect, it } from "vitest";
import { isLabExpired, isLabPickable, computeNumericStatus, formatRequirement, parseLimitText } from "./lab";

describe("isLabExpired / isLabPickable", () => {
  const today = new Date(2026, 9, 16); // 2026-10-16

  it("is expired once validUntil is in the past", () => {
    expect(isLabExpired(new Date(2026, 9, 15), today)).toBe(true);
    expect(isLabPickable(new Date(2026, 9, 15), today)).toBe(false);
  });

  it("is not expired today or in the future", () => {
    expect(isLabExpired(new Date(2026, 9, 16), today)).toBe(false);
    expect(isLabExpired(new Date(2027, 0, 1), today)).toBe(false);
    expect(isLabPickable(new Date(2027, 0, 1), today)).toBe(true);
  });

  it("treats a never-accredited lab (no validUntil) as expired", () => {
    expect(isLabExpired(null, today)).toBe(true);
    expect(isLabPickable(null, today)).toBe(false);
  });
});

describe("computeNumericStatus", () => {
  it("is UNKNOWN with no result", () => {
    expect(computeNumericStatus(null, 240, 400)).toBe("UNKNOWN");
    expect(computeNumericStatus(undefined, 240, 400)).toBe("UNKNOWN");
  });

  it("is UNKNOWN with no requirement to judge against", () => {
    expect(computeNumericStatus(1.2, null, null)).toBe("UNKNOWN");
  });

  it("is OK within a min/max band", () => {
    expect(computeNumericStatus(300, 240, 400)).toBe("OK");
    expect(computeNumericStatus(240, 240, 400)).toBe("OK");
    expect(computeNumericStatus(400, 240, 400)).toBe("OK");
  });

  it("is NG below min or above max", () => {
    expect(computeNumericStatus(239.9, 240, 400)).toBe("NG");
    expect(computeNumericStatus(400.1, 240, 400)).toBe("NG");
  });

  it("is OK with a min-only requirement (yield strength style)", () => {
    expect(computeNumericStatus(250, 240, null)).toBe("OK");
    expect(computeNumericStatus(230, 240, null)).toBe("NG");
  });

  // Acceptance: an out-of-limit Mn (IS 2062 E250 BR: mnMax ~ 1.5) marks NG.
  it("flags an out-of-limit chemical element (Mn) as NG", () => {
    expect(computeNumericStatus(1.6, 0, 1.5)).toBe("NG");
    expect(computeNumericStatus(1.4, 0, 1.5)).toBe("OK");
  });
});

describe("parseLimitText (hardness requirement text)", () => {
  it("parses a range", () => {
    expect(parseLimitText("120-160 HB")).toEqual({ min: 120, max: 160 });
    expect(parseLimitText("120 HV to 160 HV")).toEqual({ min: 120, max: 160 });
  });

  it("parses a single max or min bound", () => {
    expect(parseLimitText("Max 160 HB")).toEqual({ min: null, max: 160 });
    expect(parseLimitText("160 HB max")).toBeNull(); // trailing "max" with no number after it isn't guessed
    expect(parseLimitText("≥ 120 HV")).toEqual({ min: 120, max: null });
    expect(parseLimitText("Minimum 45 HRC")).toEqual({ min: 45, max: null });
  });

  it("parses separately stated bounds", () => {
    expect(parseLimitText("Min 120, Max 160 HB")).toEqual({ min: 120, max: 160 });
  });

  it("returns null for qualitative or empty text", () => {
    expect(parseLimitText("As per drawing")).toBeNull();
    expect(parseLimitText(null)).toBeNull();
  });

  it("drives OK/NG once parsed", () => {
    const limits = parseLimitText("Max 160 HB")!;
    expect(computeNumericStatus(170, limits.min, limits.max)).toBe("NG");
    expect(computeNumericStatus(150, limits.min, limits.max)).toBe("OK");
  });
});

describe("formatRequirement", () => {
  // IS 2062 E250 BR limits, as seeded.
  it("formats a min/max band, min-only and max-only requirement", () => {
    expect(formatRequirement(410, 540, null)).toBe("410-540"); // UTS
    expect(formatRequirement(250, null, null)).toBe("Min 250"); // Yield strength
    expect(formatRequirement(null, 1.5, null)).toBe("Max 1.5"); // Mn
  });

  it("prefers free text and falls back to a dash", () => {
    expect(formatRequirement(null, null, "As per drawing")).toBe("As per drawing");
    expect(formatRequirement(null, null, null)).toBe("-");
  });
});
