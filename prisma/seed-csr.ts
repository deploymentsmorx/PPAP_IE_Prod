import path from "node:path";
import ExcelJS from "exceljs";
import { prisma } from "../lib/prisma";
import { saveUploadedFile } from "../lib/storage";
import { imageSize } from "../lib/image-size";
import { ZONE_COLOURS } from "../lib/calc/csr";

/**
 * Element 17 (CSR) seed from sheet "17. CSR".
 *
 * Library (customer TLD STL): zones A/B/C with their rules transcribed
 * verbatim from page 1 of the sheet (rule numbering stripped, kept as
 * ruleNo); the zone C illustration (image91) is the picture grouped on
 * that page.
 *
 * Zone maps (seed PPAP): the sheet's 5 picture pages (rows 48/98/148/198/
 * 248), each picture with the same crop Excel applies (drawing17.xml
 * srcRect, l/t/r/b in 1/1000 %). image87 and image89 each carry an "A" and
 * a "B" view and are placed twice (top half / bottom half). The zones are
 * already drawn into these screenshots (arrows + labels), so no extra
 * annotations are seeded.
 */

const ZONES: { code: "A" | "B" | "C"; description: string; rules: { text: string; criteriaKey?: string }[] }[] = [
  {
    code: "A",
    description: "No defect tolerated",
    rules: [
      { text: "Weld beads may remain rough unless irregular and/or exhibiting protrusions" },
      { text: "Grind marks, weld splashes (slag, burrs..), sheet metal defects, V-bend traces with material tearing are not tolerated" },
      { text: "Sealing joints must be smooth and regular" },
      { text: "Body filler mandatory and invisible under coating" },
      {
        text: "Tensioned paint film, no scratches, runs, or foreign bodies (dust or others), no visible retouch, minimum dry film thickness 120µm (primer + finish)",
        criteriaKey: "DFT",
      },
      { text: "Gloss tolerance: between 80% and 90% at 60°", criteriaKey: "GLOSS" },
      { text: "The observer must inspect the surface from a distance of 1 metre", criteriaKey: "VIEWING_DISTANCE" },
    ],
  },
  {
    code: "B",
    description: "Some defects tolerated",
    rules: [
      { text: "Appearance defects on welds tolerated (overthickness, spillage…)" },
      { text: "Authorized paint defects: minor runs, minor contamination, textured surface (uneven), sanding marks, hazy paint." },
      { text: "Grind marks less than 3 cm² and depth less than 1 mm Gloss tolerance: 80% 0/-20 at 60°" },
    ],
  },
  {
    code: "C",
    description: "Corrosion protection must be ensured necessarily",
    rules: [{ text: "Paint defects tolerated: runs, grains, contamination, lack, orange peel, grinding marks)" }],
  },
];

const pct = (n: number) => n / 100_000;
const PAGES: { image: string; crop: [number, number, number, number]; caption: string }[][] = [
  [{ image: "image86", crop: [11070, 7936, 10811, 10039], caption: "Visible Area - A" }],
  [
    { image: "image87", crop: [11389, 7785, 10592, 50866], caption: "Visible Area - A" },
    { image: "image87", crop: [11389, 48688, 10592, 2306], caption: "Moderate Visible Area - B" },
  ],
  [{ image: "image88", crop: [11785, 8633, 11524, 10089], caption: "Visible Area - A" }],
  [
    { image: "image89", crop: [7410, 7809, 11525, 50862], caption: "Visible Area - A" },
    { image: "image89", crop: [7410, 49011, 11525, 10040], caption: "Moderately Visible Area - B" },
  ],
  [{ image: "image90", crop: [10581, 7570, 10591, 50856], caption: "Moderately Visible Area - B" }],
];

async function loadMedia() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.join(__dirname, "..", "reference", "PPAP_Checklist.xlsx"));
  const media = (workbook.model as unknown as { media: { name: string; extension: string; buffer: Buffer }[] }).media;
  return new Map(media.map((m) => [m.name, m]));
}

async function store(media: Map<string, { name: string; extension: string; buffer: Buffer }>, name: string, subdir: string) {
  const m = media.get(name);
  if (!m) throw new Error(`Picture ${name} not found in the reference workbook.`);
  const file = new File([new Uint8Array(m.buffer)], `${name}.${m.extension}`, { type: `image/${m.extension === "jpg" ? "jpeg" : m.extension}` });
  const saved = await saveUploadedFile(file, subdir);
  return { ...saved, size: imageSize(new Uint8Array(m.buffer)) };
}

export async function seedCsrFromReferenceSheet(customerId: string, ppapId: string) {
  const media = await loadMedia();

  // ---- Library (TLD STL) ----
  let rules = 0;
  for (const [i, zone] of ZONES.entries()) {
    const existing = await prisma.csrSection.findUnique({ where: { customerId_code: { customerId, code: zone.code } } });
    const section =
      existing ??
      (await prisma.csrSection.create({
        data: { customerId, code: zone.code, title: `Zone ${zone.code}`, description: zone.description, isZone: true, colour: ZONE_COLOURS[zone.code], sortOrder: i },
      }));
    if (zone.code === "C" && !section.imageUrl) {
      const img = await store(media, "image91", `csr/${customerId}`);
      await prisma.csrSection.update({ where: { id: section.id }, data: { imageUrl: img.url, imageName: "Zone C — inside of the frame" } });
    }
    if ((await prisma.csrRequirement.count({ where: { sectionId: section.id } })) === 0) {
      await prisma.csrRequirement.createMany({
        data: zone.rules.map((r, n) => ({ sectionId: section.id, ruleNo: n + 1, text: r.text, criteriaKey: r.criteriaKey ?? null, sortOrder: n + 1 })),
      });
      rules += zone.rules.length;
    }
  }

  // ---- Zone-map pages (seed PPAP) ----
  const element = await prisma.ppapElement.findUniqueOrThrow({ where: { ppapId_elementNo: { ppapId, elementNo: 17 } } });
  let pages = 0;
  if ((await prisma.csrZoneMapPage.count({ where: { ppapElementId: element.id } })) === 0) {
    const stored = new Map<string, Awaited<ReturnType<typeof store>>>();
    for (const [p, views] of PAGES.entries()) {
      const page = await prisma.csrZoneMapPage.create({ data: { ppapElementId: element.id, sortOrder: p } });
      for (const [v, view] of views.entries()) {
        if (!stored.has(view.image)) stored.set(view.image, await store(media, view.image, `ppap-elements/${element.id}/csr-zone-maps`));
        const img = stored.get(view.image)!;
        const [l, t, r, b] = view.crop.map(pct);
        await prisma.csrZoneMapView.create({
          data: {
            pageId: page.id,
            imageUrl: img.url,
            imageName: img.fileName,
            imageWidth: img.size?.width ?? null,
            imageHeight: img.size?.height ?? null,
            crop: { l, t, r, b },
            caption: view.caption,
            sortOrder: v,
          },
        });
      }
      pages++;
    }
  }
  return { rules, pages };
}
