/**
 * Element 17 (CSR) pure helpers: zone colours, zone-map annotation JSON,
 * picture crops, criteria parsed from the CSR rule text (consumed by AAR,
 * element 13), and the compliance summary.
 */

export type Zone = "A" | "B" | "C";

/** Zone colours, as on the reference sheet (blue A arrows, green B arrows, magenta C box). */
export const ZONE_COLOURS: Record<Zone, string> = { A: "#4472C4", B: "#70AD47", C: "#A3309D" };

export const ZONE_LABELS: Record<Zone, string> = {
  A: "Visible Area A",
  B: "Moderately Visible Area B",
  C: "Zone C (corrosion protection only)",
};

export type ZoneAnnotation =
  | { kind: "rect"; zone: Zone; label?: string; x: number; y: number; w: number; h: number }
  | { kind: "polygon"; zone: Zone; label?: string; points: [number, number][] };

const isFrac = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;
const isZone = (z: unknown): z is Zone => z === "A" || z === "B" || z === "C";

/** Validates stored annotation JSON, dropping malformed shapes instead of failing the page. */
export function parseAnnotations(json: unknown): ZoneAnnotation[] {
  if (!Array.isArray(json)) return [];
  const out: ZoneAnnotation[] = [];
  for (const a of json) {
    if (!a || typeof a !== "object" || !isZone((a as { zone?: unknown }).zone)) continue;
    const label = typeof (a as { label?: unknown }).label === "string" ? (a as { label: string }).label : undefined;
    if ((a as { kind?: unknown }).kind === "rect") {
      const { x, y, w, h, zone } = a as { x: unknown; y: unknown; w: unknown; h: unknown; zone: Zone };
      if (isFrac(x) && isFrac(y) && isFrac(w) && isFrac(h) && w > 0 && h > 0) out.push({ kind: "rect", zone, label, x, y, w, h });
    } else if ((a as { kind?: unknown }).kind === "polygon") {
      const { points, zone } = a as { points: unknown; zone: Zone };
      if (Array.isArray(points) && points.length >= 3 && points.every((p) => Array.isArray(p) && p.length === 2 && isFrac(p[0]) && isFrac(p[1]))) {
        out.push({ kind: "polygon", zone, label, points: points as [number, number][] });
      }
    }
  }
  return out;
}

/** Rectangle from two drag corners (any direction), clamped to the picture. */
export function rectFromDrag(a: [number, number], b: [number, number]): { x: number; y: number; w: number; h: number } {
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  const [x1, y1, x2, y2] = [clamp(a[0]), clamp(a[1]), clamp(b[0]), clamp(b[1])];
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
}

export type Crop = { l: number; t: number; r: number; b: number };

export function parseCrop(json: unknown): Crop | null {
  if (!json || typeof json !== "object") return null;
  const { l, t, r, b } = json as Record<string, unknown>;
  if (![l, t, r, b].every(isFrac)) return null;
  const crop = { l, t, r, b } as Crop;
  return crop.l + crop.r < 1 && crop.t + crop.b < 1 ? crop : null;
}

/**
 * CSS for showing only the cropped part of a picture: the wrapper takes
 * the cropped aspect ratio; the <img> is scaled up and shifted so the
 * crop window fills it. Annotations are then drawn in wrapper fractions.
 */
export function cropLayout(crop: Crop | null, width: number | null, height: number | null) {
  const c = crop ?? { l: 0, t: 0, r: 0, b: 0 };
  const visibleW = 1 - c.l - c.r;
  const visibleH = 1 - c.t - c.b;
  return {
    aspectRatio: width && height ? (width * visibleW) / (height * visibleH) : null,
    img: { widthPct: 100 / visibleW, heightPct: 100 / visibleH, leftPct: (-c.l / visibleW) * 100, topPct: (-c.t / visibleH) * 100 },
  };
}

export type ZoneCriteria = {
  gloss: { minPct: number; maxPct: number; angleDeg: number; text: string } | null;
  minDftUm: { value: number; text: string } | null;
  viewingDistanceM: { value: number; text: string } | null;
};

/**
 * Numbers in the CSR rule text that AAR uses as acceptance criteria, e.g.
 * "Gloss tolerance: between 80% and 90% at 60°", "minimum dry film
 * thickness 120µm", "from a distance of 1 metre". Rules are matched by
 * criteriaKey first, then by wording.
 */
export function extractZoneCriteria(requirements: { text: string; criteriaKey: string | null }[]): ZoneCriteria {
  const result: ZoneCriteria = { gloss: null, minDftUm: null, viewingDistanceM: null };
  for (const r of requirements) {
    const t = r.text;
    if (!result.gloss && (r.criteriaKey === "GLOSS" || /gloss/i.test(t))) {
      const m = /(\d+(?:\.\d+)?)\s*%\s*(?:and|-|to|–)\s*(\d+(?:\.\d+)?)\s*%\s*at\s*(\d+)\s*°/i.exec(t);
      if (m) result.gloss = { minPct: Number(m[1]), maxPct: Number(m[2]), angleDeg: Number(m[3]), text: t };
    }
    if (!result.minDftUm && (r.criteriaKey === "DFT" || /dry film thickness|dft/i.test(t))) {
      const m = /(?:minimum|min\.?)\s*(?:dry film thickness|dft)?\s*(\d+(?:\.\d+)?)\s*(?:µm|um|micron)/i.exec(t);
      if (m) result.minDftUm = { value: Number(m[1]), text: t };
    }
    if (!result.viewingDistanceM && (r.criteriaKey === "VIEWING_DISTANCE" || /distance/i.test(t))) {
      const m = /distance of\s*(\d+(?:\.\d+)?)\s*(?:m|metre|meter)s?\b/i.exec(t);
      if (m) result.viewingDistanceM = { value: Number(m[1]), text: t };
    }
  }
  return result;
}

/**
 * AAR (element 13) criteria from the customer's zone A rules — the
 * strictest, "no defect tolerated" zone. Keys are AAR parameter names.
 */
export function aarCriteriaFromCsr(zoneA: ZoneCriteria | null): Record<string, { acceptanceCriteria?: string; evaluationMethod?: string }> {
  if (!zoneA) return {};
  const out: Record<string, { acceptanceCriteria?: string; evaluationMethod?: string }> = {};
  const visual = zoneA.viewingDistanceM ? `Visual at ${zoneA.viewingDistanceM.value} m (CSR)` : undefined;
  if (zoneA.gloss) out["Gloss Level"] = { acceptanceCriteria: `${zoneA.gloss.minPct}–${zoneA.gloss.maxPct}% at ${zoneA.gloss.angleDeg}° (CSR Zone A)` };
  if (zoneA.minDftUm) out["Paint Thickness"] = { acceptanceCriteria: `Min ${zoneA.minDftUm.value} µm DFT, primer + finish (CSR Zone A)` };
  out["Scratches / Dents"] = { acceptanceCriteria: "Not tolerated in Zone A (CSR)", ...(visual ? { evaluationMethod: visual } : {}) };
  if (visual) {
    for (const p of ["Colour / Shade", "Surface Finish", "Orange Peel", "Uniformity"]) out[p] = { evaluationMethod: visual };
  }
  return out;
}

export function complianceSummary(rows: { complied: boolean | null }[]) {
  return {
    total: rows.length,
    complied: rows.filter((r) => r.complied === true).length,
    notComplied: rows.filter((r) => r.complied === false).length,
    pending: rows.filter((r) => r.complied == null).length,
  };
}
