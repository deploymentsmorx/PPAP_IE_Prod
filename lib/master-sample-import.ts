import type ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { parseRetentionYears, parseMasterSampleStatus } from "@/lib/calc/master-sample";

const SHEET_NAME = "15. Master Sample";

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return "";
  if (typeof v === "object" && "richText" in v) return v.richText.map((t) => t.text).join("").trim();
  if (typeof v === "object" && "result" in v) return String(v.result ?? "").trim();
  return String(v).trim();
}

/** Date cell → UTC midnight. Handles real date cells and raw Excel serials (46299 → 2026-10-04). */
function cellDate(cell: ExcelJS.Cell): Date | null {
  const v = cell.value;
  if (v instanceof Date) return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  if (typeof v === "number") return new Date(Date.UTC(1899, 11, 30) + v * 86_400_000);
  return null;
}

/**
 * Imports the register rows of sheet "15. Master Sample" into an element
 * 15. Columns are located by their header text (row containing "Sample
 * ID"), so column moves don't break it. Part name/no., customer, drawing,
 * rev and level are master data on the owning PPAP and are not imported —
 * the reference sheet's "1170750" part no. is the same part as master
 * "1170750-RAW" (sheet quirk), not a second part. Upserts by sample ID, so
 * re-running doesn't duplicate rows.
 */
export async function importMasterSampleWorkbook(workbook: ExcelJS.Workbook, ppapElementId: string): Promise<{ imported: number }> {
  const sheet = workbook.getWorksheet(SHEET_NAME);
  if (!sheet) throw new Error(`Sheet "${SHEET_NAME}" not found.`);

  let headerRowNo = 0;
  const col: Record<string, number> = {};
  sheet.eachRow((row, rowNo) => {
    if (headerRowNo) return;
    row.eachCell((cell, colNo) => {
      const t = cellText(cell).toLowerCase();
      if (t === "sample id") headerRowNo = rowNo;
      if (t === "approval date") col.approvalDate = colNo;
      if (t === "sample id") col.sampleId = colNo;
      if (t === "storage location") col.storageLocation = colNo;
      if (t.startsWith("retention")) col.retention = colNo;
      if (t === "status") col.status = colNo;
      if (t === "remarks") col.remarks = colNo;
    });
  });
  if (!headerRowNo || !col.sampleId) throw new Error(`No "Sample ID" header row on sheet "${SHEET_NAME}".`);

  let imported = 0;
  for (let rowNo = headerRowNo + 1; rowNo <= sheet.rowCount; rowNo++) {
    const row = sheet.getRow(rowNo);
    const sampleIdCell = row.getCell(col.sampleId);
    // The register ends at the first blank sample ID, or at the "Image
    // Ref." box below it — one big merged range whose text ExcelJS
    // reports for every cell inside it.
    if (sampleIdCell.isMerged) break;
    const sampleId = cellText(sampleIdCell);
    if (!sampleId) break;

    const data = {
      approvalDate: col.approvalDate ? cellDate(row.getCell(col.approvalDate)) : null,
      storageLocation: col.storageLocation ? cellText(row.getCell(col.storageLocation)) || null : null,
      retentionYears: col.retention ? parseRetentionYears(cellText(row.getCell(col.retention))) : null,
      status: parseMasterSampleStatus(col.status ? cellText(row.getCell(col.status)) : null),
      remarks: col.remarks ? cellText(row.getCell(col.remarks)) || null : null,
    };
    await prisma.masterSample.upsert({
      where: { ppapElementId_sampleId: { ppapElementId, sampleId } },
      update: data,
      create: { ppapElementId, sampleId, sortOrder: imported, ...data },
    });
    imported++;
  }
  return { imported };
}
