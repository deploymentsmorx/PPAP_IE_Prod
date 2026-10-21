import path from "node:path";
import ExcelJS from "exceljs";
import { prisma } from "../lib/prisma";
import { importMasterSampleWorkbook } from "../lib/master-sample-import";

/**
 * Element 15 (Master Sample): imports the register from sheet "15. Master
 * Sample" — one row, NBL-001, approved 04-10-2026 (Excel serial 46299),
 * Prod. Area, 3Years, Active, "Initial Submission" — via the same importer
 * an "Import Excel" action would use. Footer: Prepared By Santhosh BG
 * (already the seeded preparer), Approved By Rajesh Goel (no date on the
 * sheet). The importer upserts by sample ID, so re-running is safe.
 */
export async function seedMasterSampleFromReferenceSheet(ppapId: string, approverId: string) {
  const element = await prisma.ppapElement.findUniqueOrThrow({ where: { ppapId_elementNo: { ppapId, elementNo: 15 } } });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.join(__dirname, "..", "reference", "PPAP_Checklist.xlsx"));
  const result = await importMasterSampleWorkbook(workbook, element.id);
  if (!element.approvedById) {
    await prisma.ppapElement.update({ where: { id: element.id }, data: { approvedById: approverId } });
  }
  return result;
}
