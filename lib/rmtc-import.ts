import ExcelJS from "exceljs";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Shared import logic for element 10 (Material / Performance Test Results —
 * RM Test Reports). Used both by prisma/seed.ts (importing the reference
 * sample directly) and the "Import Excel" server action.
 *
 * The sheet has a fixed 9-row data block (rows 10-18 in the reference
 * workbook) directly below a two-row repeated header. Rows are detected by
 * column A matching a plain Sl No pattern; the mill TC cell combines a
 * free-text TC number with a trailing "DD-MM-YYYY" date in one cell (e.g.
 * "909953485    31-12-2025") — split here so the date is usable, while the
 * TC number is kept verbatim.
 */

// Every non-data row's column A is text (a label like "Sl. No." or
// "Customer Name:"), so a pure-digit Sl No is sufficient to pick out the
// 9 real data rows without needing a header-label exclusion list.
const SL_NO_PATTERN = /^\d+$/;
const TRAILING_DATE_PATTERN = /^(.*\S)\s+(\d{2}-\d{2}-\d{4})\s*$/;

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

function parseIndianDate(text: string): Date | null {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(text);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  return Number.isFinite(date.getTime()) ? date : null;
}

function splitMillTc(text: string): { millTcNo: string | null; millTcDate: Date | null } {
  const trimmed = text.trim();
  if (!trimmed) return { millTcNo: null, millTcDate: null };
  const match = TRAILING_DATE_PATTERN.exec(trimmed);
  if (!match) return { millTcNo: trimmed, millTcDate: null };
  return { millTcNo: match[1].trim(), millTcDate: parseIndianDate(match[2]) };
}

function splitMaterialSpecText(text: string): { standard: string; grade: string } | null {
  // "IS 2062 E250 BR" -> standard "IS 2062", grade "E250 BR". The standard
  // is always "<letters> <digits>"; everything after that is the grade.
  const match = /^([A-Za-z]+\s*\d+)\s+(.+)$/.exec(text.trim());
  if (!match) return null;
  return { standard: match[1].trim(), grade: match[2].trim() };
}

export type ParsedRmtcRow = {
  slNo: string;
  partNo: string | null;
  materialSpecText: string | null;
  requiredSizeText: string | null;
  qtyNos: number | null;
  observedSizeText: string | null;
  millTcNo: string | null;
  millTcDate: Date | null;
  heatNo: string | null;
  plateNo: string | null;
  materialIdNo: string | null;
  labReportNo: string | null;
  remarks: string | null;
};

function findRmtcSheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
  const sheet = workbook.worksheets.find((s) => /rmtc/i.test(s.name) || /^10\./.test(s.name));
  if (!sheet) throw new Error('No "RMTC Reports" sheet found in the uploaded workbook.');
  return sheet;
}

export function parseRmtcSheet(sheet: ExcelJS.Worksheet): ParsedRmtcRow[] {
  const rows: ParsedRmtcRow[] = [];

  sheet.eachRow({ includeEmpty: false }, (row) => {
    const col1 = cellText(row.getCell(1).value);
    if (!col1 || !SL_NO_PATTERN.test(col1)) return;

    const qtyText = cellText(row.getCell(8).value);
    const qty = qtyText && Number.isFinite(Number(qtyText)) ? Number(qtyText) : null;
    const { millTcNo, millTcDate } = splitMillTc(cellText(row.getCell(11).value));

    rows.push({
      slNo: col1,
      partNo: cellText(row.getCell(2).value) || null,
      materialSpecText: cellText(row.getCell(4).value) || null,
      requiredSizeText: cellText(row.getCell(6).value) || null,
      qtyNos: qty,
      observedSizeText: cellText(row.getCell(9).value) || null,
      millTcNo,
      millTcDate,
      heatNo: cellText(row.getCell(13).value) || null,
      plateNo: cellText(row.getCell(15).value) || null,
      materialIdNo: cellText(row.getCell(17).value) || null,
      labReportNo: cellText(row.getCell(19).value) || null,
      remarks: cellText(row.getCell(21).value) || null,
    });
  });

  return rows;
}

async function resolveMaterialSpecId(materialSpecText: string | null): Promise<string | null> {
  if (!materialSpecText) return null;
  const parts = splitMaterialSpecText(materialSpecText);
  if (!parts) return null;
  const spec = await prisma.materialSpec.findUnique({
    where: { standard_grade: { standard: parts.standard, grade: parts.grade } },
  });
  return spec?.id ?? null;
}

async function wipeExistingRows(detailId: string) {
  await prisma.rmtcReportRow.deleteMany({ where: { rmtcReportDetailId: detailId } });
}

export async function importRmtcWorkbook(workbook: ExcelJS.Workbook, ppapElementId: string): Promise<{ imported: number }> {
  const sheet = findRmtcSheet(workbook);
  const parsedRows = parseRmtcSheet(sheet);

  let detail = await prisma.rmtcReportDetail.findUnique({ where: { ppapElementId } });
  if (!detail) {
    detail = await prisma.rmtcReportDetail.create({ data: { ppapElementId } });
  }

  await wipeExistingRows(detail.id);

  for (let i = 0; i < parsedRows.length; i++) {
    const r = parsedRows[i];
    const materialSpecId = await resolveMaterialSpecId(r.materialSpecText);
    await prisma.rmtcReportRow.create({
      data: {
        id: randomUUID(),
        rmtcReportDetailId: detail.id,
        slNo: r.slNo,
        partNo: r.partNo,
        materialSpecId,
        materialSpecText: r.materialSpecText,
        requiredSizeText: r.requiredSizeText,
        qtyNos: r.qtyNos,
        observedSizeText: r.observedSizeText,
        millTcNo: r.millTcNo,
        millTcDate: r.millTcDate,
        heatNo: r.heatNo,
        plateNo: r.plateNo,
        materialIdNo: r.materialIdNo,
        labReportNo: r.labReportNo,
        remarks: r.remarks,
        sortOrder: i,
      },
    });
  }

  return { imported: parsedRows.length };
}
