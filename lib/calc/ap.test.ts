import { describe, expect, it } from "vitest";
import { calculateActionPriority, bandOf, parseApText, type ApLevel } from "./ap";

// Expected AP per [sBand][oBand][dBand] (bands ascending 0=1-2 .. 4=9-10),
// transcribed independently from the AIAG-VDA PFMEA Action Priority table
// as a cross-check against lib/calc/ap.ts's own copy.
const EXPECTED: ApLevel[][][] = [
  [
    ["LOW", "LOW", "LOW", "LOW", "LOW"],
    ["LOW", "LOW", "LOW", "LOW", "LOW"],
    ["LOW", "LOW", "LOW", "LOW", "LOW"],
    ["LOW", "LOW", "LOW", "LOW", "LOW"],
    ["LOW", "LOW", "LOW", "LOW", "LOW"],
  ],
  [
    ["LOW", "LOW", "LOW", "LOW", "MEDIUM"],
    ["LOW", "LOW", "LOW", "MEDIUM", "MEDIUM"],
    ["LOW", "LOW", "MEDIUM", "MEDIUM", "HIGH"],
    ["LOW", "MEDIUM", "MEDIUM", "HIGH", "HIGH"],
    ["MEDIUM", "MEDIUM", "HIGH", "HIGH", "HIGH"],
  ],
  [
    ["LOW", "LOW", "LOW", "MEDIUM", "MEDIUM"],
    ["LOW", "LOW", "MEDIUM", "MEDIUM", "HIGH"],
    ["LOW", "MEDIUM", "MEDIUM", "HIGH", "HIGH"],
    ["MEDIUM", "MEDIUM", "HIGH", "HIGH", "HIGH"],
    ["MEDIUM", "HIGH", "HIGH", "HIGH", "HIGH"],
  ],
  [
    ["LOW", "LOW", "MEDIUM", "MEDIUM", "HIGH"],
    ["LOW", "MEDIUM", "MEDIUM", "HIGH", "HIGH"],
    ["MEDIUM", "MEDIUM", "HIGH", "HIGH", "HIGH"],
    ["MEDIUM", "HIGH", "HIGH", "HIGH", "HIGH"],
    ["HIGH", "HIGH", "HIGH", "HIGH", "HIGH"],
  ],
  [
    ["LOW", "MEDIUM", "HIGH", "HIGH", "HIGH"],
    ["MEDIUM", "HIGH", "HIGH", "HIGH", "HIGH"],
    ["HIGH", "HIGH", "HIGH", "HIGH", "HIGH"],
    ["HIGH", "HIGH", "HIGH", "HIGH", "HIGH"],
    ["HIGH", "HIGH", "HIGH", "HIGH", "HIGH"],
  ],
];

// Both boundary values of each band, so band-edge handling is verified too.
const BAND_VALUES = [
  [1, 2],
  [3, 4],
  [5, 6],
  [7, 8],
  [9, 10],
];

describe("bandOf", () => {
  it("maps every 1-10 rating to its 2-wide band", () => {
    expect([1, 2].map(bandOf)).toEqual([0, 0]);
    expect([3, 4].map(bandOf)).toEqual([1, 1]);
    expect([5, 6].map(bandOf)).toEqual([2, 2]);
    expect([7, 8].map(bandOf)).toEqual([3, 3]);
    expect([9, 10].map(bandOf)).toEqual([4, 4]);
  });
});

describe("calculateActionPriority", () => {
  it("matches the spec's worked example: S9 O5 D2 = High", () => {
    expect(calculateActionPriority(9, 5, 2)).toBe("HIGH");
  });

  it("covers every one of the 125 S/O/D band combinations", () => {
    for (let sBand = 0; sBand < 5; sBand++) {
      for (let oBand = 0; oBand < 5; oBand++) {
        for (let dBand = 0; dBand < 5; dBand++) {
          const expected = EXPECTED[sBand][oBand][dBand];
          for (const s of BAND_VALUES[sBand]) {
            for (const o of BAND_VALUES[oBand]) {
              for (const d of BAND_VALUES[dBand]) {
                expect(
                  calculateActionPriority(s, o, d),
                  `S=${s} O=${o} D=${d} (bands ${sBand},${oBand},${dBand})`,
                ).toBe(expected);
              }
            }
          }
        }
      }
    }
  });

  it("is monotonically non-decreasing as severity, occurrence, or detection worsens", () => {
    const rank: Record<ApLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
    for (let s = 1; s <= 10; s++) {
      for (let o = 1; o <= 10; o++) {
        for (let d = 1; d <= 10; d++) {
          const current = rank[calculateActionPriority(s, o, d)];
          if (s < 10) expect(rank[calculateActionPriority(s + 1, o, d)]).toBeGreaterThanOrEqual(current);
          if (o < 10) expect(rank[calculateActionPriority(s, o + 1, d)]).toBeGreaterThanOrEqual(current);
          if (d < 10) expect(rank[calculateActionPriority(s, o, d + 1)]).toBeGreaterThanOrEqual(current);
        }
      }
    }
  });

  it("never returns High for the lowest severity band regardless of O/D", () => {
    for (const s of [1, 2]) {
      for (let o = 1; o <= 10; o++) {
        for (let d = 1; d <= 10; d++) {
          expect(calculateActionPriority(s, o, d)).toBe("LOW");
        }
      }
    }
  });

  it("always returns High for the top severity/occurrence/detection corner", () => {
    expect(calculateActionPriority(10, 10, 10)).toBe("HIGH");
  });
});

describe("parseApText", () => {
  it("normalizes common free-typed forms", () => {
    expect(parseApText("High")).toBe("HIGH");
    expect(parseApText("H")).toBe("HIGH");
    expect(parseApText(" high ")).toBe("HIGH");
    expect(parseApText("Medium")).toBe("MEDIUM");
    expect(parseApText("Med")).toBe("MEDIUM");
    expect(parseApText("Low")).toBe("LOW");
    expect(parseApText("l")).toBe("LOW");
  });

  it("returns null for empty or unrecognized text", () => {
    expect(parseApText(null)).toBeNull();
    expect(parseApText(undefined)).toBeNull();
    expect(parseApText("")).toBeNull();
    expect(parseApText("n/a")).toBeNull();
  });
});
