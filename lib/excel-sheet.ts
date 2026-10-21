import type ExcelJS from "exceljs";

const THIN = { style: "thin" as const };
const HEAD_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
const NG_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFECACA" } };

/**
 * Sequential writer for the form-style element exports (AAR, Sample
 * Production Part, ...): merged section headings and bordered, wrapped
 * table rows, written top to bottom.
 */
export function createSheetWriter(sheet: ExcelJS.Worksheet, columns: number) {
  let r = 1;

  function heading(text: string, size?: number) {
    sheet.mergeCells(r, 1, r, columns);
    const c = sheet.getCell(r, 1);
    c.value = text;
    c.font = { bold: true, ...(size ? { size } : {}) };
    r++;
  }

  function tableRow(values: (string | number | null | undefined)[], opts: { head?: boolean; ng?: boolean } = {}) {
    const row = sheet.getRow(r);
    values.forEach((v, i) => {
      row.getCell(i + 1).value = v ?? "-";
    });
    for (let c = 1; c <= columns; c++) {
      const cell = row.getCell(c);
      cell.border = { top: THIN, left: THIN, bottom: THIN, right: THIN };
      cell.alignment = { vertical: "top", wrapText: true };
      if (opts.head) cell.fill = HEAD_FILL;
      else if (opts.ng) cell.fill = NG_FILL;
    }
    if (opts.head) row.font = { bold: true };
    r++;
  }

  /** Doc No. / Rev. line under the title, as on every sheet header. */
  function docLine(docNo: string | null, revision: string) {
    sheet.getCell(r, 1).value = "Doc. No.";
    sheet.getCell(r, 2).value = docNo ?? "-";
    sheet.getCell(r, 3).value = "Rev.";
    sheet.getCell(r, 4).value = revision;
    r++;
  }

  function gap() {
    r++;
  }

  return { heading, tableRow, docLine, gap };
}
