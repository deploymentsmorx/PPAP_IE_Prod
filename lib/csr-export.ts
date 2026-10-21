import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getCsrComplianceView } from "@/lib/csr";
import { PPAP_ELEMENT_NAMES } from "@/lib/constants/ppap-elements";
import { createSheetWriter } from "@/lib/excel-sheet";

/**
 * Element 17 workbook: zone definitions + compliance (one row per
 * requirement), then the zone-map pages' captions. The pictures
 * themselves are in the print/PDF.
 */
export async function exportCsrWorkbook(ppapElementId: string): Promise<ExcelJS.Workbook> {
  const el = await prisma.ppapElement.findUniqueOrThrow({ where: { id: ppapElementId } });
  if (el.elementNo !== 17) throw new Error("Not a CSR (element 17) page.");
  const { element, customer, sections } = await getCsrComplianceView(el.ppapId);
  const pages = await prisma.csrZoneMapPage.findMany({ where: { ppapElementId }, orderBy: { sortOrder: "asc" }, include: { views: { orderBy: { sortOrder: "asc" } } } });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("17. CSR", { pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  sheet.columns = [10, 70, 12, 28, 28].map((width) => ({ width }));
  const { heading, tableRow, docLine, gap } = createSheetWriter(sheet, 5);

  heading("Smorx", 14);
  heading(`CSR - CUSTOMER SPECIFIC REQUIREMENTS — ${customer.name}`, 12);
  docLine(element.docNo, element.revision);
  gap();
  if (element.applicability === "NA") {
    heading(`N/A — ${element.naReason ?? ""}`);
    return workbook;
  }

  tableRow(["Zone / Rule", "Requirement", "Complied", "Evidence", "Remark"], { head: true });
  for (const s of sections) {
    heading(`${s.code} — ${s.title}${s.description ? `: ${s.description}` : ""}`);
    for (const r of s.requirements) {
      const c = r.compliance;
      tableRow(
        [
          `${s.code}${r.ruleNo}`,
          r.text,
          c.complied === true ? "Y" : c.complied === false ? "N" : "Not assessed",
          [c.evidenceElementNo != null ? `${c.evidenceElementNo}. ${PPAP_ELEMENT_NAMES[c.evidenceElementNo]}` : null, c.evidenceFileName].filter(Boolean).join("; ") || "",
          c.remark ?? "",
        ],
        { ng: c.complied === false },
      );
    }
  }
  gap();
  heading("Zone maps (pictures in the print / PDF)");
  pages.forEach((p, i) => tableRow([`Page ${i + 1}`, p.views.map((v) => v.caption ?? v.imageName).join(" | ") || "(no pictures)", "", "", ""]));
  return workbook;
}
