import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { formatDateIndia } from "@/lib/format";
import { computeNumericStatus, formatRequirement, type NumericStatus } from "@/lib/calc/lab";
import { parseRangeText } from "@/lib/calc/tolerance";

const MECHANICAL_LABEL: Record<string, string> = {
  YIELD_STRENGTH: "Yield Strength",
  UTS: "Ultimate Tensile Strength",
  ELONGATION: "Elongation%",
  HARDNESS: "Hardness",
  IMPACT: "Impact Energy",
};
const CHEMICAL_LABEL: Record<string, string> = { C: "C", MN: "Mn", SI: "Si", S: "S", P: "P", CR: "Cr", NI: "Ni", MO: "Mo", OTHER: "Other" };
const PAINT_LABEL: Record<string, string> = { DFT: "DFT", ADHESION: "Adhesion", GLOSS: "Glossy", VISUAL: "Visual Inspection" };

const COLUMNS = 6;
const THIN = { style: "thin" as const };
const NG_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFECACA" } };
const HEAD_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };

function statusText(status: NumericStatus): string {
  return status === "UNKNOWN" ? "-" : status;
}

/**
 * Element 12 workbook: one portrait sheet, reports stacked top to bottom in
 * the same order and sections as the print route (header block, tests
 * performed, mechanical, chemical, paint), then the QA verification block.
 * NG rows are shaded the same as the print view.
 */
export async function exportLabWorkbook(ppapElementId: string): Promise<ExcelJS.Workbook> {
  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { id: ppapElementId },
    include: {
      preparedBy: true,
      checkedBy: true,
      approvedBy: true,
      ppap: { include: { customer: true, partRevision: { include: { part: true } } } },
      labReports: {
        orderBy: { sortOrder: "asc" },
        include: {
          lab: true,
          materialSpec: true,
          rmtcReportRow: true,
          testDetails: { orderBy: { sortOrder: "asc" } },
          mechanicalResults: true,
          chemicalResults: true,
          paintResults: true,
        },
      },
    },
  });
  if (element.elementNo !== 12) {
    throw new Error("Not a Lab Reports (element 12) page.");
  }

  const part = element.ppap.partRevision.part;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("12. LAB Reports", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.columns = [{ width: 22 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 14 }, { width: 22 }];

  let r = 1;

  function boxed(row: ExcelJS.Row, fill?: ExcelJS.Fill) {
    for (let c = 1; c <= COLUMNS; c++) {
      const cell = row.getCell(c);
      cell.border = { top: THIN, left: THIN, bottom: THIN, right: THIN };
      cell.alignment = { vertical: "top", wrapText: true };
      if (fill) cell.fill = fill;
    }
  }

  function heading(text: string) {
    sheet.mergeCells(r, 1, r, COLUMNS);
    const cell = sheet.getCell(r, 1);
    cell.value = text;
    cell.font = { bold: true };
    r++;
  }

  function tableRow(values: (string | number | null)[], opts: { head?: boolean; ng?: boolean } = {}) {
    const row = sheet.getRow(r);
    values.forEach((v, i) => {
      row.getCell(i + 1).value = v ?? "-";
    });
    if (opts.head) row.font = { bold: true };
    boxed(row, opts.head ? HEAD_FILL : opts.ng ? NG_FILL : undefined);
    r++;
  }

  // ---- Title block (mirrors <PrintHeader>) ----
  sheet.mergeCells(r, 1, r, COLUMNS);
  sheet.getCell(r, 1).value = "Ingenious Engineering";
  sheet.getCell(r, 1).font = { bold: true, size: 14 };
  r++;
  sheet.mergeCells(r, 1, r, COLUMNS);
  sheet.getCell(r, 1).value = "PPAP DOCUMENTS";
  sheet.getCell(r, 1).font = { bold: true, size: 12 };
  r++;
  sheet.mergeCells(r, 1, r, COLUMNS);
  sheet.getCell(r, 1).value = "LAB REPORTS";
  sheet.getCell(r, 1).font = { bold: true, size: 12 };
  r++;
  sheet.getCell(r, 1).value = "Doc. No.";
  sheet.getCell(r, 2).value = element.docNo ?? "-";
  sheet.getCell(r, 3).value = "Rev.";
  sheet.getCell(r, 4).value = element.revision;
  r += 2;

  if (element.applicability === "NA") {
    heading(`N/A — ${element.naReason ?? ""}`);
  } else if (element.labReports.length === 0) {
    heading("No lab reports recorded.");
  }

  for (const report of element.applicability === "NA" ? [] : element.labReports) {
    const materialGrade = report.materialSpec ? `${report.materialSpec.standard} ${report.materialSpec.grade}` : report.materialGradeText;
    const heatBatchNo = report.rmtcReportRow?.heatNo || report.heatBatchNoText;

    heading(`Lab Report ${report.reportNo || "(no report no.)"}`);
    tableRow(["Company", report.companyName, "Lab", report.lab?.name ?? null, "Report No.", report.reportNo]);
    tableRow([
      "Test Date",
      report.testDate ? formatDateIndia(report.testDate) : null,
      "Accreditation",
      report.lab ? [report.lab.accreditationBody, report.lab.certificateNo].filter(Boolean).join(" ") || null : null,
      "PPAP Level",
      element.ppap.level,
    ]);
    tableRow(["Customer", element.ppap.customer.name, "Part", part.partName, "Part No.", part.partNumber]);
    tableRow([
      "Drawing No.",
      element.ppap.partRevision.drawingNo ?? part.partNumber,
      "Revision",
      element.ppap.partRevision.revision,
      "Sample Qty",
      report.sampleQty,
    ]);
    tableRow(["Material Grade", materialGrade, "Heat/Batch No", heatBatchNo, "Signed Lab PDF", report.labPdfName ?? "Not uploaded"]);
    tableRow(["Mfg. Process", report.manufacturingProcess, "Heat Treatment", report.heatTreatmentStatus, "Part Name", part.partName]);
    r++;

    heading("Tests Performed");
    tableRow(["Test", "Acceptance Criteria", "Method/Equipment", "Standard", "", ""], { head: true });
    for (const t of report.testDetails) {
      tableRow([t.testName, t.acceptanceCriteria, t.methodEquipment, t.standard, "", ""]);
    }
    r++;

    heading("Mechanical Properties");
    tableRow(["Property", "Requirement", "Result", "Unit", "Status", "Remark"], { head: true });
    for (const m of report.mechanicalResults) {
      const status = computeNumericStatus(m.result, m.requirementMin, m.requirementMax);
      tableRow(
        [MECHANICAL_LABEL[m.property] ?? m.property, formatRequirement(m.requirementMin, m.requirementMax, m.requirementText), m.result, m.unit, statusText(status), m.remark],
        { ng: status === "NG" },
      );
    }
    r++;

    heading("Chemical Composition (%)");
    tableRow(["Element", "Min", "Max", "Result", "Status", ""], { head: true });
    for (const c of report.chemicalResults) {
      const status = computeNumericStatus(c.result, c.requirementMin, c.requirementMax);
      tableRow(
        [CHEMICAL_LABEL[c.element] ?? c.element, c.requirementMin ?? c.requirementText, c.requirementMax, c.result, statusText(status), ""],
        { ng: status === "NG" },
      );
    }
    r++;

    heading("Paint");
    tableRow(["Property", "Requirement", "Result", "Unit", "Status", "Remark"], { head: true });
    for (const p of report.paintResults) {
      const range = parseRangeText(p.requirementText);
      const status = range && p.resultNumeric != null ? computeNumericStatus(p.resultNumeric, range.min, range.max) : "UNKNOWN";
      tableRow([PAINT_LABEL[p.property] ?? p.property, p.requirementText, p.resultText, p.unit, statusText(status), p.remark], { ng: status === "NG" });
    }
    r += 2;
  }

  // ---- Ingenious QA verification block (mirrors <PrintFooter>) ----
  heading("Ingenious QA Verification");
  tableRow(["Stage", "Name", "Date", "", "", ""], { head: true });
  tableRow(["Verified By", element.checkedBy?.name ?? null, element.checkedAt ? formatDateIndia(element.checkedAt) : null, "", "", ""]);
  tableRow(["Prepared By", element.preparedBy?.name ?? null, element.preparedAt ? formatDateIndia(element.preparedAt) : null, "", "", ""]);
  tableRow(["Approved By", element.approvedBy?.name ?? null, element.approvedAt ? formatDateIndia(element.approvedAt) : null, "", "", ""]);

  return workbook;
}
