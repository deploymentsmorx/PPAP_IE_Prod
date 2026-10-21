import { prisma } from "@/lib/prisma";
import { formatDateIndia } from "@/lib/format";
import { calibrationStatus, formatFrequencyMonths, type CalibrationStatus } from "@/lib/calc/calibration";
import { getCheckingAidsForPpap, getDueSoonDays } from "@/lib/instruments";
import { FIXTURE_TYPE_LABEL, FIXTURE_STATUS_LABEL } from "@/lib/constants/fixtures";
import { PrintHeader } from "@/components/print-header";
import { PrintFooter } from "@/components/print-footer";

const cell = "border border-black p-1 align-top";

/** The sheet's REMARKS column, where the author typed "Due is near" — now the live status. */
const STATUS_REMARK: Record<CalibrationStatus, string> = { VALID: "", DUE_SOON: "Due is near", OVERDUE: "Overdue", NOT_CALIBRATED: "Not calibrated" };

/**
 * Mirrors the reference sheet "16. Checking Aids" (portrait) — the master
 * list of measuring instruments — restricted to the instruments this part
 * uses, then its fixtures/templates/jigs.
 */
export async function CheckingAidsPrint({ ppapId }: { ppapId: string }) {
  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { ppapId_elementNo: { ppapId, elementNo: 16 } },
    include: { preparedBy: true, checkedBy: true, approvedBy: true },
  });
  const [aids, dueSoonDays] = await Promise.all([getCheckingAidsForPpap(ppapId), getDueSoonDays()]);
  const today = new Date();

  return (
    <div className="mx-auto max-w-4xl bg-white p-6 text-black print:p-0">
      <style>{`@page { size: A4 portrait; margin: 10mm; }`}</style>
      <PrintHeader supplierName="Smorx" title="PPAP DOCUMENTS" subtitle="MASTER LIST OF MEASURING INSTRUMENTS" docNo={element.docNo} revision={element.revision} />

      {element.applicability === "NA" ? (
        <p className="mt-4 text-sm">N/A — {element.naReason}</p>
      ) : (
        <>
          <table className="mt-2 w-full border-collapse border border-black text-[9px]">
            <thead>
              <tr className="bg-gray-100">
                {["SL NO.", "DESCRIPTION", "RANGE", "SERIAL NO.", "IE-ID-NO", "MAKE", "CALIBRATION FREQUENCY", "CALIBRATED ON", "CALIBRATION DUE", "LOCATION", "REMARKS"].map((h) => (
                  <th key={h} className={cell}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {aids.instruments.map((i, idx) => {
                const status = calibrationStatus(i.calibrationDue, today, dueSoonDays);
                const remark = [STATUS_REMARK[status], i.remarks].filter(Boolean).join("; ");
                return (
                  <tr key={i.id} className={status === "OVERDUE" || status === "NOT_CALIBRATED" ? "bg-red-100" : status === "DUE_SOON" ? "bg-amber-100" : undefined}>
                    <td className={`${cell} text-center`}>{idx + 1}</td>
                    <td className={cell}>{i.description}</td>
                    <td className={cell}>{i.range ?? "-"}</td>
                    <td className={cell}>{i.serialNo ?? ""}</td>
                    <td className={cell}>{i.ieIdNo ?? ""}</td>
                    <td className={cell}>{i.make ?? ""}</td>
                    <td className={cell}>{formatFrequencyMonths(i.calibrationFrequencyMonths)}</td>
                    <td className={cell}>{i.calibratedOn ? formatDateIndia(i.calibratedOn) : "-"}</td>
                    <td className={cell}>{i.calibrationDue ? formatDateIndia(i.calibrationDue) : "-"}</td>
                    <td className={cell}>{i.location ?? ""}</td>
                    <td className={cell}>{remark}</td>
                  </tr>
                );
              })}
              {aids.instruments.length === 0 ? (
                <tr>
                  <td className={cell} colSpan={11}>
                    No instruments referenced.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          {aids.fixtures.length > 0 ? (
            <table className="mt-3 w-full border-collapse border border-black text-[9px]">
              <thead>
                <tr className="bg-gray-100">
                  {["CODE", "DESCRIPTION", "TYPE", "DRAWING NO.", "VALIDATED ON", "STATUS", "LOCATION", "REMARKS"].map((h) => (
                    <th key={h} className={cell}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {aids.fixtures.map((f) => (
                  <tr key={f.id}>
                    <td className={cell}>{f.code}</td>
                    <td className={cell}>{f.description}</td>
                    <td className={cell}>{FIXTURE_TYPE_LABEL[f.type]}</td>
                    <td className={cell}>{f.drawingNo ?? "-"}</td>
                    <td className={cell}>{f.validationDate ? formatDateIndia(f.validationDate) : "-"}</td>
                    <td className={cell}>{FIXTURE_STATUS_LABEL[f.status]}</td>
                    <td className={cell}>{f.location ?? ""}</td>
                    <td className={cell}>{f.remarks ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </>
      )}

      <PrintFooter
        entries={[
          { label: "Prepared By", name: element.preparedBy?.name ?? null, date: element.preparedAt },
          { label: "Checked By", name: element.checkedBy?.name ?? null, date: element.checkedAt },
          { label: "Approved By", name: element.approvedBy?.name ?? null, date: element.approvedAt },
        ]}
      />
    </div>
  );
}
