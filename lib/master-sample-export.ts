import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { formatDateIndia } from "@/lib/format";
import { masterSampleExpiry } from "@/lib/calc/master-sample";
import { createSheetWriter } from "@/lib/excel-sheet";

const STATUS_LABEL = { ACTIVE: "Active", SUPERSEDED: "Superseded", DISPOSED: "Disposed" } as const;

/**
 * Element 15 workbook: sheet "15. Master Sample" with the reference
 * sheet's register columns (plus computed Expiry), then Prepared/Approved.
 * Uses the same header texts the importer looks for, so an exported file
 * re-imports cleanly.
 */
export async function exportMasterSampleWorkbook(ppapElementId: string): Promise<ExcelJS.Workbook> {
  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { id: ppapElementId },
    include: {
      preparedBy: true,
      approvedBy: true,
      masterSamples: { orderBy: { sortOrder: "asc" }, include: { images: true } },
      ppap: { include: { customer: true, partRevision: { include: { part: true } } } },
    },
  });
  if (element.elementNo !== 15) {
    throw new Error("Not a Master Sample (element 15) page.");
  }
  const { ppap } = element;
  const part = ppap.partRevision.part;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("15. Master Sample", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.columns = [28, 14, 12, 14, 6, 10, 14, 12, 16, 14, 14, 12, 22].map((width) => ({ width }));
  const { heading, tableRow, docLine, gap } = createSheetWriter(sheet, 13);

  heading("Ingenious Engineering", 14);
  heading("PPAP DOCUMENTS — MASTER SAMPLE", 12);
  docLine(element.docNo, element.revision);
  gap();

  if (element.applicability === "NA") {
    heading(`N/A — ${element.naReason ?? ""}`);
    return workbook;
  }

  tableRow(
    ["Part Name", "Part No", "Customer", "Drawing No", "Rev", "PPAP Level", "Approval Date", "Sample ID", "Storage Location", "Retention Period", "Expiry", "Status", "Remarks"],
    { head: true },
  );
  for (const r of element.masterSamples) {
    const expiry = masterSampleExpiry(r.approvalDate, r.retentionYears);
    tableRow([
      part.partName,
      part.partNumber,
      ppap.customer.name,
      ppap.partRevision.drawingNo ?? part.partNumber,
      ppap.partRevision.revision,
      `L-${ppap.level}`,
      r.approvalDate ? formatDateIndia(r.approvalDate) : null,
      r.sampleId,
      r.storageLocation,
      r.retentionYears != null ? `${r.retentionYears}Years` : null,
      expiry ? formatDateIndia(expiry) : null,
      STATUS_LABEL[r.status],
      r.remarks ?? "",
    ]);
  }
  const photoCount = element.masterSamples.reduce((n, r) => n + r.images.length, 0);
  gap();
  heading(`Image Ref.: ${photoCount} photo(s) attached in the app (see print/PDF).`);
  gap();
  tableRow(["Prepared By", element.preparedBy?.name ?? "", element.preparedAt ? formatDateIndia(element.preparedAt) : "", "", "", "", "", "", "", "", "", "", ""], { head: true });
  tableRow(["Approved By", element.approvedBy?.name ?? "", element.approvedAt ? formatDateIndia(element.approvedAt) : "", "", "", "", "", "", "", "", "", "", ""], { head: true });

  return workbook;
}
