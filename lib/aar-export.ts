import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { formatDateIndia } from "@/lib/format";
import { ensureAarCriteriaRows, getSupplierForHeader } from "@/lib/aar";
import { createSheetWriter } from "@/lib/excel-sheet";
import { getSppSampleIdsForPpap } from "@/lib/spp";

const REASON_LABEL: Record<string, string> = {
  NEW_PART: "New Part",
  ENGINEERING_CHANGE: "Engineering Change",
  TOOLING_CHANGE: "Tooling Change",
  SUPPLIER_CHANGE: "Supplier Change",
  OTHER: "Other",
};
const CONDITION_LABEL: Record<string, string> = { PROTOTYPE: "Prototype", TRIAL_RUN: "Trial Run", MASS_PRODUCTION: "Mass Production" };
const RESULT_LABEL: Record<string, string> = { APPROVED: "Approved", CONDITIONALLY_APPROVED: "Conditionally Approved", REJECTED: "Rejected" };
const DISPOSITION_LABEL: Record<string, string> = { APPROVED: "Approved", REJECTED: "Rejected", CONDITIONAL: "Conditionally approved" };

/**
 * Element 13 workbook: one portrait sheet "13. AAR" with the same six
 * sections, in order, as the reference sheet and the print route.
 */
export async function exportAarWorkbook(ppapElementId: string): Promise<ExcelJS.Workbook> {
  const { ppapId, elementNo } = await prisma.ppapElement.findUniqueOrThrow({ where: { id: ppapElementId } });
  if (elementNo !== 13) {
    throw new Error("Not an AAR (element 13) page.");
  }
  await ensureAarCriteriaRows(ppapElementId, ppapId);

  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { id: ppapElementId },
    include: {
      preparedBy: true,
      checkedBy: true,
      aarDetail: true,
      aarCriteriaRows: { orderBy: { sortOrder: "asc" }, include: { photos: true } },
      customerDisposition: true,
      ppap: { include: { customer: true, partRevision: { include: { part: true } } } },
    },
  });
  const supplier = await getSupplierForHeader();
  const { ppap } = element;
  const part = ppap.partRevision.part;
  const d = element.aarDetail;
  const cd = element.customerDisposition;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("13. AAR", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.columns = [{ width: 8 }, { width: 26 }, { width: 26 }, { width: 22 }, { width: 22 }, { width: 30 }];
  const { heading, tableRow, docLine, gap } = createSheetWriter(sheet, 6);

  heading("Smorx", 14);
  heading("PPAP DOCUMENTS — AAR", 12);
  docLine(element.docNo, element.revision);
  heading("APPEARANCE APPROVAL REPORT (AAR)", 12);
  gap();

  if (element.applicability === "NA") {
    heading(`N/A — ${element.naReason ?? ""}`);
    return workbook;
  }

  heading("1. Header Information");
  tableRow(["", "Supplier Name", supplier.name, "Submission Level", `Level-${ppap.level}`, ""]);
  tableRow(["", "Supplier Code", supplier.code, "Reason for Submission", ppap.reasonForSubmission, ""]);
  tableRow([
    "",
    "Customer Name",
    ppap.customer.name,
    "Submission Reason",
    d?.submissionReason ? REASON_LABEL[d.submissionReason] : null,
    d?.submissionReason === "OTHER" ? d.submissionReasonOther : "",
  ]);
  tableRow(["", "Part Name", part.partName, "Part Number", part.partNumber, ""]);
  tableRow(["", "Revision Level", ppap.partRevision.revision, "Date", d?.reportDate ? formatDateIndia(d.reportDate) : null, ""]);
  gap();

  heading("2. Appearance Criteria Details");
  tableRow(["Sl. No", "Appearance Parameter", "Specification / Standard", "Evaluation Method", "Acceptance Criteria", "Result"], { head: true });
  element.aarCriteriaRows.forEach((row, i) => {
    tableRow([i + 1, row.parameter, row.specification, row.evaluationMethod, row.acceptanceCriteria, row.result ?? ""]);
  });
  gap();

  heading("3. Sample Information");
  tableRow(["", "Sample Size", d?.sampleSize, "No. of Samples Evaluated", d?.samplesEvaluated, ""]);
  tableRow(["", "Sample Identification / Batch No.", d?.sampleIds || (await getSppSampleIdsForPpap(ppapId)), "Production Condition", d?.productionCondition ? CONDITION_LABEL[d.productionCondition] : null, ""]);
  gap();

  heading("4. Master Sample Reference");
  tableRow(["", "Master Sample No.", d?.masterSampleNo, "Approved by", d?.masterSampleApprovedBy, ""]);
  tableRow([
    "",
    "Approval Date",
    d?.masterSampleApprovalDate ? formatDateIndia(d.masterSampleApprovalDate) : null,
    "Retained Location",
    d?.masterSampleLocation,
    "",
  ]);
  gap();

  heading("5. Evaluation Summary");
  tableRow(["", "Overall Result", d?.overallResult ? RESULT_LABEL[d.overallResult] : null, "", "", ""]);
  tableRow(["", "Deviation Details", d?.deviationDetails, "", "", ""]);
  tableRow(["", "Corrective Action Plan", d?.correctiveActionPlan, "", "", ""]);
  gap();

  heading("6. Approval Section");
  tableRow(["", "Function", "Name", "Date", "Status / Comments", ""], { head: true });
  tableRow(["", "Prepared By (Supplier QA)", element.preparedBy?.name, element.preparedAt ? formatDateIndia(element.preparedAt) : null, "", ""]);
  tableRow(["", "Reviewed By", element.checkedBy?.name, element.checkedAt ? formatDateIndia(element.checkedAt) : null, "", ""]);
  tableRow([
    "",
    "Customer Approval",
    [cd?.customerName, cd?.customerDesignation].filter(Boolean).join(", ") || null,
    cd?.customerSignatureDate ? formatDateIndia(cd.customerSignatureDate) : null,
    [cd?.status ? DISPOSITION_LABEL[cd.status] : null, cd?.comments].filter(Boolean).join(" — ") || null,
    "",
  ]);

  const photoCount = element.aarCriteriaRows.reduce((n, row) => n + row.photos.length, 0);
  if (photoCount > 0) {
    gap();
    heading(`Photo evidence: ${photoCount} photo(s) attached in the app (see print/PDF).`);
  }

  return workbook;
}
