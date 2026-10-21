import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { formatDateIndia } from "@/lib/format";
import { calibrationStatus, formatFrequencyMonths } from "@/lib/calc/calibration";
import { getCheckingAidsForPpap, getDueSoonDays } from "@/lib/instruments";
import { FIXTURE_TYPE_LABEL, FIXTURE_STATUS_LABEL } from "@/lib/constants/fixtures";
import { createSheetWriter } from "@/lib/excel-sheet";

const STATUS_REMARK = { VALID: "", DUE_SOON: "Due is near", OVERDUE: "Overdue", NOT_CALIBRATED: "Not calibrated" } as const;

/**
 * Element 16 workbook: sheet "16. Checking Aids" in the reference sheet's
 * columns (the instruments this part uses), then fixtures. The header
 * texts match what lib/instrument-import.ts looks for.
 */
export async function exportCheckingAidsWorkbook(ppapElementId: string): Promise<ExcelJS.Workbook> {
  const element = await prisma.ppapElement.findUniqueOrThrow({ where: { id: ppapElementId }, include: { preparedBy: true, approvedBy: true } });
  if (element.elementNo !== 16) throw new Error("Not a Checking Aids (element 16) page.");
  const [aids, dueSoonDays] = await Promise.all([getCheckingAidsForPpap(element.ppapId), getDueSoonDays()]);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("16. Checking Aids", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.columns = [6, 28, 14, 16, 12, 12, 12, 13, 13, 18, 18].map((width) => ({ width }));
  const { heading, tableRow, docLine, gap } = createSheetWriter(sheet, 11);

  heading("INGENIOUS ENGINEERING", 14);
  heading("MASTER LIST OF MEASURING INSTRUMENTS", 12);
  docLine(element.docNo, element.revision);
  gap();
  if (element.applicability === "NA") {
    heading(`N/A — ${element.naReason ?? ""}`);
    return workbook;
  }

  tableRow(["SL NO.", "DESCRIPTION", "RANGE", "SERIAL NO.", "IE-ID-NO", "MAKE", "CALIBRATION FREQUENCY", "CALIBRATED ON", "CALIBRATION DUE", "LOCATION", "REMARKS"], { head: true });
  const today = new Date();
  aids.instruments.forEach((i, idx) => {
    const status = calibrationStatus(i.calibrationDue, today, dueSoonDays);
    tableRow(
      [
        idx + 1,
        i.description,
        i.range,
        i.serialNo,
        i.ieIdNo,
        i.make,
        formatFrequencyMonths(i.calibrationFrequencyMonths),
        i.calibratedOn ? formatDateIndia(i.calibratedOn) : null,
        i.calibrationDue ? formatDateIndia(i.calibrationDue) : null,
        i.location,
        [STATUS_REMARK[status], i.remarks].filter(Boolean).join("; "),
      ],
      { ng: status === "OVERDUE" || status === "NOT_CALIBRATED" },
    );
  });

  if (aids.fixtures.length > 0) {
    gap();
    heading("Checking fixtures, templates & jigs");
    tableRow(["CODE", "DESCRIPTION", "TYPE", "DRAWING NO.", "VALIDATED ON", "STATUS", "LOCATION", "REMARKS", "", "", ""], { head: true });
    for (const f of aids.fixtures) {
      tableRow([f.code, f.description, FIXTURE_TYPE_LABEL[f.type], f.drawingNo, f.validationDate ? formatDateIndia(f.validationDate) : null, FIXTURE_STATUS_LABEL[f.status], f.location, f.remarks ?? "", "", "", ""]);
    }
  }
  gap();
  tableRow(["Prepared By", element.preparedBy?.name ?? "", "", "Approved By", element.approvedBy?.name ?? "", "", "", "", "", "", ""]);
  return workbook;
}
