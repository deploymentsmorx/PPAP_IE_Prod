import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { formatDateIndia } from "@/lib/format";
import { getSppReadOnlyData } from "@/lib/spp";
import { SPP_DECLARATION_TEXT } from "@/lib/calc/spp";
import { createSheetWriter } from "@/lib/excel-sheet";

const DISPOSITION_LABEL: Record<string, string> = { APPROVED: "Approved", REJECTED: "Rejected", CONDITIONAL: "Conditional" };

/**
 * Element 14 workbook: one portrait sheet "14. Sample Production Part"
 * with the reference sheet's 11 sections, in order — the same data as the
 * page and print view (read-only sections via lib/spp.ts).
 */
export async function exportSppWorkbook(ppapElementId: string): Promise<ExcelJS.Workbook> {
  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { id: ppapElementId },
    include: {
      sppDetail: { include: { declaredBy: true } },
      sppSamples: { orderBy: { sortOrder: "asc" } },
      sppFunctionalTests: { orderBy: { sortOrder: "asc" } },
      sppPackagingPhotos: true,
      customerDisposition: true,
    },
  });
  if (element.elementNo !== 14) {
    throw new Error("Not a Sample Production Part (element 14) page.");
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("14. Sample Production Part", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.columns = [{ width: 26 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 14 }, { width: 24 }];
  const { heading, tableRow, docLine, gap } = createSheetWriter(sheet, 6);

  heading("Smorx", 14);
  heading("PPAP DOCUMENTS — SAMPLE PRODUCTION PART", 12);
  docLine(element.docNo, element.revision);
  heading("PRODUCTION PART SAMPLE FORMAT", 12);
  gap();

  if (element.applicability === "NA") {
    heading(`N/A — ${element.naReason ?? ""}`);
    return workbook;
  }

  const data = await getSppReadOnlyData(element.ppapId);
  const d = element.sppDetail;
  const cd = element.customerDisposition;
  const field = (label: string, value: string | number | null | undefined) => tableRow([label, value ?? "-", "", "", "", ""]);

  heading("1. General Information");
  field("Customer Name", data.general.customerName);
  field("Supplier Name", data.general.supplierName);
  field("Part Name", data.general.partName);
  field("Part Number", data.general.partNumber);
  field("Drawing Number", data.general.drawingNumber);
  field("Revision Level", data.general.revision);
  field("Date", d?.reportDate ? formatDateIndia(d.reportDate) : null);
  field("PPAP Level", `Level ${data.general.level}`);
  field("Submission Reason", data.general.submissionReason);
  gap();

  heading("2. Sample Part Details");
  field("Sample Quantity Submitted", element.sppSamples.length);
  tableRow(["Sample ID", "Lot / Batch No", "Manufacturing Date", "Shift", "Machine No", "Cavity No"], { head: true });
  for (const s of element.sppSamples) {
    tableRow([s.sampleId, s.lotBatchNo, s.manufacturingDate ? formatDateIndia(s.manufacturingDate) : null, s.shift, s.machineNo, s.cavityNo]);
  }
  gap();

  heading("3. Material Details (from 10. RM Test Reports, 12. Lab Reports)");
  tableRow(["Raw Material Grade", "Material Standard", "Heat No / Batch No", "MTC No", "", ""], { head: true });
  if (data.material.lots.length === 0) {
    tableRow([data.material.fallbackGrade, data.material.fallbackStandard, null, null, "", ""]);
  }
  for (const lot of data.material.lots) tableRow([lot.grade, lot.standard, lot.heatNo, lot.mtcNo, "", ""]);
  field("Chemical Composition", data.material.chemicalSummary);
  field("Mechanical Properties", data.material.mechanicalSummary);
  gap();

  const s = data.dimensional.summary;
  heading("4. Dimensional Inspection Results (from 9. Dimensional Results)");
  field("Summary", `${s.total} dimensions — ${s.checked} checked, ${s.ok} OK, ${s.ng} NG (${s.pctConformance}% conformance)`);
  tableRow(["Sr No", "Dimension", "Spec", "Actual", "Status", "Measuring Instrument"], { head: true });
  for (const r of data.dimensional.keyRows) {
    tableRow([r.slNo, r.dimension, r.spec, r.actual, r.status === "UNKNOWN" ? "-" : r.status, r.instrument], { ng: r.status === "NG" });
  }
  field("Ballooned Drawing", data.dimensional.drawing ? `${data.dimensional.drawing.name} (Rev ${data.dimensional.drawing.revision})` : "Not uploaded");
  gap();

  heading("5. Appearance Approval (from 13. AAR)");
  if (!data.appearance.applicable) {
    field("Not applicable", data.appearance.naReason);
  } else {
    tableRow(["Parameter", "Requirement", "Result", "", "", ""], { head: true });
    for (const r of data.appearance.rows) tableRow([r.parameter, r.requirement, r.result, "", "", ""]);
    field("AAR Overall / Customer", [data.appearance.overallResult, data.appearance.customerStatus].filter(Boolean).join(" / ") || null);
  }
  gap();

  heading("6. Functional / Performance Test");
  tableRow(["Test Name", "Specification", "Result", "Status", "", ""], { head: true });
  for (const t of element.sppFunctionalTests) tableRow([t.testName, t.specification, t.result, t.status, "", ""], { ng: t.status === "NG" });
  gap();

  heading("7. Process Details (from 5. PFC, 6. PFMEA, 7. Control Plan)");
  field("Manufacturing Process", data.process.manufacturingProcess);
  field("Special Processes", data.process.specialProcesses.join(", ") || "None identified");
  field("Control Plan Available", data.process.controlPlan);
  field("Process Flow Diagram", data.process.processFlow);
  field("PFMEA Status", data.process.pfmea);
  gap();

  heading("8. Measurement System Analysis (from 8. MSA, 16. Checking Aids)");
  tableRow(["Instrument", "Type", "Calibration Status", "GRR Status", "", ""], { head: true });
  for (const m of data.msa) tableRow([m.instrument, m.type, m.calibration, m.grr, "", ""]);
  gap();

  heading("9. Packaging Details");
  field("Packing Method", d?.packingMethod);
  field("Labeling", d?.labelling);
  field("Protection Method", d?.protectionMethod);
  if (element.sppPackagingPhotos.length > 0) field("Photos", `${element.sppPackagingPhotos.length} photo(s) attached in the app (see print/PDF)`);
  gap();

  heading("10. Declaration");
  heading(SPP_DECLARATION_TEXT);
  tableRow(["Name", "Designation", "Signature", "Date", "", ""], { head: true });
  tableRow([d?.declaredBy?.name, d?.declaredBy?.designation, "", d?.declaredAt ? formatDateIndia(d.declaredAt) : null, "", ""]);
  gap();

  heading("11. Customer Approval");
  field("Status", cd?.status ? DISPOSITION_LABEL[cd.status] : null);
  field("Customer Name", [cd?.customerName, cd?.customerDesignation].filter(Boolean).join(", ") || null);
  field("Date", cd?.customerSignatureDate ? formatDateIndia(cd.customerSignatureDate) : null);
  if (cd?.comments) field("Comments", cd.comments);

  return workbook;
}
