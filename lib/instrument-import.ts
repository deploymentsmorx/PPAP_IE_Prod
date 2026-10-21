import type ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { parseFrequencyMonths, parseSheetDate, computeCalibrationDue } from "@/lib/calc/calibration";

const SHEET_NAME = "16. Checking Aids";

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return "";
  if (typeof v === "object" && "richText" in v) return v.richText.map((t) => t.text).join("").trim();
  if (typeof v === "object" && "result" in v) return String(v.result ?? "").trim();
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

function cellRaw(cell: ExcelJS.Cell): unknown {
  const v = cell.value;
  if (v != null && typeof v === "object" && "result" in v) return v.result;
  return v;
}

/** "-" and blank cells are "no value" on this sheet. */
function textOrNull(cell: ExcelJS.Cell): string | null {
  const t = cellText(cell).replace(/\s+/g, " ");
  return t === "" || t === "-" ? null : t;
}

/**
 * The sheet's REMARKS column holds a status the author typed at the time
 * ("Due is near") — stale by now, and status is computed live — so those
 * words aren't imported as remarks; any other text is.
 */
function remarksOrNull(cell: ExcelJS.Cell): string | null {
  const t = textOrNull(cell);
  return t && !/^(due is near|due soon|overdue|ok|valid)$/i.test(t) ? t : null;
}

/**
 * Imports the instrument master list from sheet "16. Checking Aids".
 * Columns are found by header text. Dates may be real dates, Excel serials
 * or DD/MM/YYYY text (the magnetic V blocks' "22/07/2025"). Due date is
 * stored as computed (calibrated on + frequency) unless the sheet's own
 * due date differs — then the sheet's date is kept as an override, so the
 * imported dates match the sheet exactly. Upserts by IE ID no., or by
 * Sl. No. + description for the rows with no ID. Returns Sl. No. → id.
 */
export async function importInstrumentWorkbook(workbook: ExcelJS.Workbook): Promise<{ imported: number; idBySlNo: Map<number, string> }> {
  const sheet = workbook.getWorksheet(SHEET_NAME);
  if (!sheet) throw new Error(`Sheet "${SHEET_NAME}" not found.`);

  let headerRowNo = 0;
  const col: Record<string, number> = {};
  sheet.eachRow((row, rowNo) => {
    if (headerRowNo) return;
    const found: Record<string, number> = {};
    row.eachCell((cell, colNo) => {
      const t = cellText(cell).toUpperCase().replace(/\s+/g, " ").trim();
      if (t.startsWith("SL")) found.slNo = colNo;
      else if (t === "DESCRIPTION") found.description = colNo;
      else if (t === "RANGE") found.range = colNo;
      else if (t.startsWith("SERIAL")) found.serialNo = colNo;
      else if (t.replace(/ /g, "").startsWith("IE-ID")) found.ieIdNo = colNo;
      else if (t === "MAKE") found.make = colNo;
      else if (t.startsWith("CALIBRATION FREQUENCY")) found.frequency = colNo;
      else if (t === "CALIBRATED ON") found.calibratedOn = colNo;
      else if (t === "CALIBRATION DUE") found.due = colNo;
      else if (t === "LOCATION") found.location = colNo;
      else if (t === "REMARKS") found.remarks = colNo;
    });
    if (found.description && found.slNo) {
      headerRowNo = rowNo;
      Object.assign(col, found);
    }
  });
  if (!headerRowNo) throw new Error(`No header row (SL NO. / DESCRIPTION) on sheet "${SHEET_NAME}".`);

  const idBySlNo = new Map<number, string>();
  let imported = 0;
  for (let rowNo = headerRowNo + 1; rowNo <= sheet.rowCount; rowNo++) {
    const row = sheet.getRow(rowNo);
    const description = textOrNull(row.getCell(col.description));
    const slNo = Number(cellText(row.getCell(col.slNo)));
    if (!description || !Number.isInteger(slNo)) continue;

    const frequencyMonths = col.frequency ? parseFrequencyMonths(textOrNull(row.getCell(col.frequency))) : null;
    const calibratedOn = col.calibratedOn ? parseSheetDate(cellRaw(row.getCell(col.calibratedOn))) : null;
    const sheetDue = col.due ? parseSheetDate(cellRaw(row.getCell(col.due))) : null;
    const computedDue = computeCalibrationDue(calibratedOn, frequencyMonths);
    const overridden = sheetDue !== null && sheetDue.getTime() !== computedDue?.getTime();

    const data = {
      slNo,
      description,
      range: col.range ? textOrNull(row.getCell(col.range)) : null,
      serialNo: col.serialNo ? textOrNull(row.getCell(col.serialNo)) : null,
      ieIdNo: col.ieIdNo ? textOrNull(row.getCell(col.ieIdNo)) : null,
      make: col.make ? textOrNull(row.getCell(col.make)) : null,
      calibrationFrequencyMonths: frequencyMonths,
      calibratedOn,
      calibrationDue: overridden ? sheetDue : computedDue,
      calibrationDueOverridden: overridden,
      location: col.location ? textOrNull(row.getCell(col.location)) : null,
      remarks: col.remarks ? remarksOrNull(row.getCell(col.remarks)) : null,
    };

    const existing = data.ieIdNo
      ? await prisma.instrument.findUnique({ where: { ieIdNo: data.ieIdNo } })
      : await prisma.instrument.findFirst({ where: { slNo, description, ieIdNo: null } });
    const saved = existing
      ? await prisma.instrument.update({ where: { id: existing.id }, data })
      : await prisma.instrument.create({ data });
    idBySlNo.set(slNo, saved.id);
    imported++;
  }
  return { imported, idBySlNo };
}
