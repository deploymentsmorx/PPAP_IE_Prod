import { describe, expect, it } from "vitest";
import { parseDesignDimension, parseTolerance, parseDimensionAndTolerance, computeStatus, parseCombinedSpec, parseRangeText } from "./tolerance";

describe("parseDesignDimension", () => {
  it("parses a plain number", () => {
    expect(parseDesignDimension("415")).toEqual({ nominal: 415, tag: null, isAngle: false });
  });

  it("parses a number with an Int/Ext tag, preserving the original casing", () => {
    // Real sheet examples (element 9, "Design Spec. / Dim" column).
    expect(parseDesignDimension("1239 Int")).toEqual({ nominal: 1239, tag: "Int", isAngle: false });
    expect(parseDesignDimension("30 int")).toEqual({ nominal: 30, tag: "int", isAngle: false });
    expect(parseDesignDimension("1399 Ext")).toEqual({ nominal: 1399, tag: "Ext", isAngle: false });
  });

  it("parses a degree value", () => {
    expect(parseDesignDimension("45°")).toEqual({ nominal: 45, tag: null, isAngle: true });
    expect(parseDesignDimension("1.5°")).toEqual({ nominal: 1.5, tag: null, isAngle: true });
  });

  it("returns null for unparsable text", () => {
    expect(parseDesignDimension("")).toBeNull();
    expect(parseDesignDimension(null)).toBeNull();
    expect(parseDesignDimension("TBD")).toBeNull();
  });
});

describe("parseTolerance", () => {
  it("parses a symmetric tolerance", () => {
    expect(parseTolerance("±3", 415)).toEqual({ upper: 418, lower: 412 });
    expect(parseTolerance("±0.5", 213)).toEqual({ upper: 213.5, lower: 212.5 });
  });

  it("parses a symmetric degree tolerance", () => {
    expect(parseTolerance("±1°", 45)).toEqual({ upper: 46, lower: 44 });
  });

  it("parses a newline-separated asymmetric tolerance (real sheet example)", () => {
    expect(parseTolerance("+1\n-0", 60)).toEqual({ upper: 61, lower: 60 });
  });

  it("parses a slash-separated asymmetric tolerance", () => {
    expect(parseTolerance("+0.2/-0.1", 10)).toEqual({ upper: 10.2, lower: 9.9 });
  });

  it("parses one-sided MIN/MAX tolerances", () => {
    expect(parseTolerance("MIN", 50)).toEqual({ upper: Infinity, lower: 50 });
    expect(parseTolerance("max", 50)).toEqual({ upper: 50, lower: -Infinity });
  });

  it("returns null for unparsable text", () => {
    expect(parseTolerance("", 10)).toBeNull();
    expect(parseTolerance(null, 10)).toBeNull();
    expect(parseTolerance("TBD", 10)).toBeNull();
  });
});

describe("parseDimensionAndTolerance", () => {
  it("combines dimension + tolerance into a band, preserving the tag", () => {
    expect(parseDimensionAndTolerance("1239 Int", "±4")).toEqual({
      nominal: 1239,
      upper: 1243,
      lower: 1235,
      tag: "Int",
      isAngle: false,
    });
  });

  it("returns null if either side fails to parse", () => {
    expect(parseDimensionAndTolerance("TBD", "±3")).toBeNull();
    expect(parseDimensionAndTolerance("415", "TBD")).toBeNull();
  });
});

describe("computeStatus", () => {
  const band = parseDimensionAndTolerance("415", "±3")!;

  it("is OK inside the band, including at the exact boundaries", () => {
    expect(computeStatus(415, band)).toBe("OK");
    expect(computeStatus(418, band)).toBe("OK");
    expect(computeStatus(412, band)).toBe("OK");
  });

  it("is NG outside the band", () => {
    expect(computeStatus(418.1, band)).toBe("NG");
    expect(computeStatus(411.9, band)).toBe("NG");
  });

  it("is UNKNOWN when there's no reading or no parsable band", () => {
    expect(computeStatus(null, band)).toBe("UNKNOWN");
    expect(computeStatus(undefined, band)).toBe("UNKNOWN");
    expect(computeStatus(415, null)).toBe("UNKNOWN");
  });

  it("treats a one-sided MIN band correctly", () => {
    const minBand = parseDimensionAndTolerance("50", "MIN")!;
    expect(computeStatus(50, minBand)).toBe("OK");
    expect(computeStatus(1000, minBand)).toBe("OK");
    expect(computeStatus(49.9, minBand)).toBe("NG");
  });
});

describe("parseCombinedSpec", () => {
  it("splits a Control Plan-style combined 'nominal + tolerance' spec", () => {
    // Element 11's real sample: Ø76 with USL=76/LSL=75.645.
    expect(parseCombinedSpec("76 +0/-0.355")).toEqual({ nominal: 76, upper: 76, lower: 75.645, tag: null, isAngle: false });
  });

  it("handles a diameter symbol prefix and a symmetric tolerance", () => {
    expect(parseCombinedSpec("ø45 ±1")).toEqual({ nominal: 45, upper: 46, lower: 44, tag: null, isAngle: false });
  });

  it("returns null for non-numeric Control Plan specs (the common case)", () => {
    expect(parseCombinedSpec("As per drawing")).toBeNull();
    expect(parseCombinedSpec("Free from rust")).toBeNull();
    expect(parseCombinedSpec(null)).toBeNull();
  });
});

describe("parseRangeText", () => {
  it("parses the real Control Plan Gloss Value spec", () => {
    expect(parseRangeText("80 GU to 90 GU")).toEqual({ min: 80, max: 90 });
  });

  it("parses a plain dash range", () => {
    expect(parseRangeText("40-70")).toEqual({ min: 40, max: 70 });
  });

  it("returns null for qualitative Control Plan specs (the common case)", () => {
    expect(parseRangeText("Ref. DMS296")).toBeNull();
    expect(parseRangeText("No peel off etc")).toBeNull();
    expect(parseRangeText(null)).toBeNull();
  });
});
