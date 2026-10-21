import { describe, expect, it } from "vitest";
import { parsePlateSize, computePlateFlags, DEFAULT_PLATE_TOLERANCE } from "./plate";

describe("parsePlateSize", () => {
  it("parses a plain T x W x L size", () => {
    expect(parsePlateSize("10X2000X6300")).toEqual({ thickness: 10, width: 2000, length: 6300 });
  });

  it("parses decimals and lowercase x", () => {
    expect(parsePlateSize("3.1x1250x2500")).toEqual({ thickness: 3.1, width: 1250, length: 2500 });
  });

  it("returns null for unparsable text", () => {
    expect(parsePlateSize("")).toBeNull();
    expect(parsePlateSize(null)).toBeNull();
    expect(parsePlateSize("TBD")).toBeNull();
    expect(parsePlateSize("10X2000")).toBeNull();
  });
});

describe("computePlateFlags", () => {
  it("is not flagged when required/observed can't both be parsed", () => {
    expect(computePlateFlags("TBD", "3.1X1250X2500").flagged).toBe(false);
    expect(computePlateFlags("3X1250X2500", null).flagged).toBe(false);
  });

  // The real element-10 sample (part 1170750, 9 raw-material lots) — every
  // row's deviation is within the default tolerance, so nothing is flagged.
  it.each([
    ["3X1250X2500", "3.1X1250X2500"],
    ["4X1250X2500", "4.15X1250X2512"],
    ["5X1515X6300", "5.05X1520X6315"],
    ["10X2000X6300", "10.1X2015X6320"],
    ["12X2000X7000", "12.15X2015X7020"],
    ["15X2500X6300", "15.1X2515X6315"],
    ["20X2500X6000", "20.2X2521X6025"],
    ["25X1200X12000", "25.1X1210X12020"],
    ["30X2570X6000", "30.1X2570X6020"],
  ])("sample lot %s -> %s is not flagged", (required, observed) => {
    expect(computePlateFlags(required, observed, DEFAULT_PLATE_TOLERANCE).flagged).toBe(false);
  });

  it("flags an observed 3.4mm thickness on a required 3mm plate", () => {
    const result = computePlateFlags("3X1250X2500", "3.4X1250X2500", DEFAULT_PLATE_TOLERANCE);
    expect(result.flagged).toBe(true);
    expect(result.flaggedDims).toEqual(["thickness"]);
    expect(result.deltas.thickness).toBeCloseTo(0.4);
  });

  it("flags width/length deviations beyond the configurable tolerance", () => {
    const result = computePlateFlags("10X2000X6300", "10.1X2050X6350", { thicknessMm: 0.3, widthMm: 30, lengthMm: 30 });
    expect(result.flagged).toBe(true);
    expect(result.flaggedDims).toEqual(["width", "length"]);
  });

  it("respects a tighter configurable tolerance", () => {
    const result = computePlateFlags("3X1250X2500", "3.1X1250X2500", { thicknessMm: 0.05, widthMm: 30, lengthMm: 30 });
    expect(result.flagged).toBe(true);
    expect(result.flaggedDims).toEqual(["thickness"]);
  });

  it("is OK exactly at the tolerance boundary", () => {
    const result = computePlateFlags("3X1250X2500", "3.3X1250X2500", DEFAULT_PLATE_TOLERANCE);
    expect(result.flagged).toBe(false);
  });
});
