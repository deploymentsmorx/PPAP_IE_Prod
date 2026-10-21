import ExcelJS from "exceljs";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Shared import logic for element 9 (Dimensional Report). Used both by
 * prisma/seed.ts (importing the reference sample directly) and the real
 * "Import Excel" server action.
 *
 * The sheet has no fixed data-row range: each "view" (Coupe A-A, Top View,
 * etc.) is its own labeled block of rows, repeated with the full
 * customer/drawing/part header on every print page. Rows are detected by
 * column A matching a Sl No pattern ("1", "60 A", "127A", ...); any other
 * non-empty text in column A that isn't one of the sheet's own header
 * labels is treated as a new view name for the rows that follow it.
 */

const HEADER_LABELS = new Set([
  "ingenious engineering pvt ltd",
  "inspection report",
  "customer:",
  "drawing number",
  "part name:",
  "sl no",
  "inspected by:",
  "approved by:",
  "comments-",
  "parameter description",
  "design spec.",
  "dim",
  "tol",
  "instrument used",
  "actual dimension (t/w)",
  "actual dimension (f/w)",
  "remarks",
  "date",
]);

const SL_NO_PATTERN = /^\d+\s*[A-Za-z]?$/;

function cellText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") {
    const rt = v as { richText?: { text: string }[]; text?: string; result?: unknown };
    if (rt.richText) return rt.richText.map((r) => r.text).join("").trim();
    if (rt.result !== undefined) return String(rt.result).trim();
    if (rt.text) return rt.text.trim();
    return "";
  }
  return String(v).trim();
}

function normalizeLabel(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export type ParsedDimensionalReportRow = {
  slNo: string;
  view: string | null;
  parameterDescription: string | null;
  designDimensionText: string | null;
  toleranceText: string | null;
  instrumentUsedText: string | null;
  remarks: string | null;
};

function findDimensionalReportSheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
  const sheet = workbook.worksheets.find((s) => /dimensional report/i.test(s.name) || /^9\./.test(s.name));
  if (!sheet) throw new Error('No "Dimensional Report" sheet found in the uploaded workbook.');
  return sheet;
}

export function parseDimensionalReportSheet(sheet: ExcelJS.Worksheet): ParsedDimensionalReportRow[] {
  const rows: ParsedDimensionalReportRow[] = [];
  let currentView: string | null = null;

  sheet.eachRow({ includeEmpty: false }, (row) => {
    const col1 = cellText(row.getCell(1).value);
    if (!col1) return;

    if (SL_NO_PATTERN.test(col1)) {
      rows.push({
        slNo: col1,
        view: currentView,
        parameterDescription: cellText(row.getCell(2).value) || null,
        designDimensionText: cellText(row.getCell(3).value) || null,
        toleranceText: cellText(row.getCell(4).value) || null,
        instrumentUsedText: cellText(row.getCell(5).value) || null,
        remarks: cellText(row.getCell(8).value) || null,
      });
      return;
    }

    if (!HEADER_LABELS.has(normalizeLabel(col1))) {
      currentView = col1;
    }
  });

  return rows;
}

async function wipeExistingRows(detailId: string) {
  const existing = await prisma.dimensionalReportRow.findMany({ where: { dimensionalReportDetailId: detailId }, select: { id: true } });
  const ids = existing.map((r) => r.id);
  if (ids.length === 0) return;
  await prisma.dimensionalReportReading.deleteMany({ where: { dimensionalReportRowId: { in: ids } } });
  await prisma.dimensionalReportRow.deleteMany({ where: { dimensionalReportDetailId: detailId } });
}

/// Creates the default "T/W" / "F/W" sample columns the first time a
/// report is touched — does nothing if any sample columns already exist,
/// so re-importing rows never resets user-added sample columns.
export async function ensureDefaultSampleColumns(detailId: string): Promise<void> {
  const existing = await prisma.dimensionalReportSampleColumn.count({ where: { dimensionalReportDetailId: detailId } });
  if (existing > 0) return;
  await prisma.dimensionalReportSampleColumn.createMany({
    data: [
      { id: randomUUID(), dimensionalReportDetailId: detailId, label: "T/W", sortOrder: 0 },
      { id: randomUUID(), dimensionalReportDetailId: detailId, label: "F/W", sortOrder: 1 },
    ],
  });
}

export async function importDimensionalReportWorkbook(workbook: ExcelJS.Workbook, ppapElementId: string): Promise<{ imported: number }> {
  const sheet = findDimensionalReportSheet(workbook);
  const parsedRows = parseDimensionalReportSheet(sheet);

  let detail = await prisma.dimensionalReportDetail.findUnique({ where: { ppapElementId } });
  if (!detail) {
    detail = await prisma.dimensionalReportDetail.create({ data: { ppapElementId } });
  }

  await ensureDefaultSampleColumns(detail.id);
  await wipeExistingRows(detail.id);

  await prisma.dimensionalReportRow.createMany({
    data: parsedRows.map((r, i) => ({
      id: randomUUID(),
      dimensionalReportDetailId: detail!.id,
      slNo: r.slNo,
      view: r.view,
      parameterDescription: r.parameterDescription,
      designDimensionText: r.designDimensionText,
      toleranceText: r.toleranceText,
      instrumentUsedText: r.instrumentUsedText,
      remarks: r.remarks,
      sortOrder: i,
    })),
  });

  return { imported: parsedRows.length };
}
