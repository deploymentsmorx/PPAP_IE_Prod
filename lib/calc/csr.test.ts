import { describe, expect, it } from "vitest";
import { parseAnnotations, rectFromDrag, parseCrop, cropLayout, extractZoneCriteria, aarCriteriaFromCsr, complianceSummary } from "./csr";

// The reference sheet's TLD STL zone A rules (verbatim).
const ZONE_A = [
  { text: "Weld beads may remain rough unless irregular and/or exhibiting protrusions", criteriaKey: null },
  { text: "Tensioned paint film, no scratches, runs, or foreign bodies (dust or others), no visible retouch, minimum dry film thickness 120µm (primer + finish)", criteriaKey: "DFT" },
  { text: "Gloss tolerance: between 80% and 90% at 60°", criteriaKey: "GLOSS" },
  { text: "The observer must inspect the surface from a distance of 1 metre", criteriaKey: "VIEWING_DISTANCE" },
];

describe("extractZoneCriteria", () => {
  it("reads gloss 80-90% at 60°, min DFT 120 µm and 1 m viewing distance from the sheet's wording", () => {
    const c = extractZoneCriteria(ZONE_A);
    expect(c.gloss).toMatchObject({ minPct: 80, maxPct: 90, angleDeg: 60 });
    expect(c.minDftUm?.value).toBe(120);
    expect(c.viewingDistanceM?.value).toBe(1);
  });

  it("finds nothing in rules without numbers", () => {
    expect(extractZoneCriteria([{ text: "Corrosion protection must be ensured", criteriaKey: null }])).toEqual({ gloss: null, minDftUm: null, viewingDistanceM: null });
  });
});

describe("aarCriteriaFromCsr", () => {
  it("maps zone A criteria onto the AAR's parameters", () => {
    const m = aarCriteriaFromCsr(extractZoneCriteria(ZONE_A));
    expect(m["Gloss Level"].acceptanceCriteria).toBe("80–90% at 60° (CSR Zone A)");
    expect(m["Paint Thickness"].acceptanceCriteria).toBe("Min 120 µm DFT, primer + finish (CSR Zone A)");
    expect(m["Colour / Shade"].evaluationMethod).toBe("Visual at 1 m (CSR)");
    expect(m["Scratches / Dents"].acceptanceCriteria).toBe("Not tolerated in Zone A (CSR)");
  });

  it("is empty without a CSR library", () => {
    expect(aarCriteriaFromCsr(null)).toEqual({});
  });
});

describe("parseAnnotations", () => {
  it("keeps valid rectangles and polygons, drops malformed shapes", () => {
    const parsed = parseAnnotations([
      { kind: "rect", zone: "A", label: "Front", x: 0.1, y: 0.2, w: 0.3, h: 0.1 },
      { kind: "polygon", zone: "B", points: [[0.1, 0.1], [0.4, 0.1], [0.3, 0.5]] },
      { kind: "rect", zone: "D", x: 0, y: 0, w: 0.1, h: 0.1 }, // unknown zone
      { kind: "rect", zone: "A", x: 0.5, y: 0.5, w: 0, h: 0.2 }, // zero width
      { kind: "polygon", zone: "C", points: [[0, 0], [1, 1]] }, // too few points
      "junk",
    ]);
    expect(parsed.map((a) => a.kind + a.zone)).toEqual(["rectA", "polygonB"]);
    expect(parseAnnotations(null)).toEqual([]);
  });
});

describe("rectFromDrag", () => {
  it("normalises a drag in any direction and clamps to the picture", () => {
    expect(rectFromDrag([0.6, 0.7], [0.2, 0.1])).toEqual({ x: 0.2, y: 0.1, w: expect.closeTo(0.4), h: expect.closeTo(0.6) });
    expect(rectFromDrag([-0.2, 0.5], [0.3, 1.4])).toEqual({ x: 0, y: 0.5, w: 0.3, h: 0.5 });
  });
});

describe("crops", () => {
  // Sheet page 3, top half of image87: l=11.389% t=7.785% r=10.592% b=50.866%.
  const top = { l: 0.11389, t: 0.07785, r: 0.10592, b: 0.50866 };

  it("accepts the sheet's crop fractions and rejects impossible ones", () => {
    expect(parseCrop(top)).toEqual(top);
    expect(parseCrop({ l: 0.6, t: 0, r: 0.5, b: 0 })).toBeNull();
    expect(parseCrop(null)).toBeNull();
  });

  it("scales and shifts the image so only the crop window shows", () => {
    const layout = cropLayout(top, 1115, 1567);
    const visibleW = 1 - top.l - top.r;
    expect(layout.img.widthPct).toBeCloseTo(100 / visibleW);
    expect(layout.img.leftPct).toBeCloseTo((-top.l / visibleW) * 100);
    expect(layout.aspectRatio).toBeCloseTo((1115 * visibleW) / (1567 * (1 - top.t - top.b)));
    expect(cropLayout(null, null, null)).toEqual({ aspectRatio: null, img: { widthPct: 100, heightPct: 100, leftPct: -0, topPct: -0 } });
  });
});

describe("complianceSummary", () => {
  it("counts complied, not complied and not yet assessed", () => {
    expect(complianceSummary([{ complied: true }, { complied: false }, { complied: null }, { complied: true }])).toEqual({ total: 4, complied: 2, notComplied: 1, pending: 1 });
  });
});
