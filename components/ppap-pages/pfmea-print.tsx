import { prisma } from "@/lib/prisma";
import { formatDateIndia } from "@/lib/format";
import { calculateActionPriority } from "@/lib/calc/ap";
import { calculateRpn } from "@/lib/calc/fmea";
import { PrintFooter } from "@/components/print-footer";

const ROWS_PER_PAGE_TARGET = 20;

export async function PfmeaPrint({ ppapId }: { ppapId: string }) {
  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { ppapId_elementNo: { ppapId, elementNo: 6 } },
    include: {
      preparedBy: true,
      approvedBy: true,
      ppap: { include: { partRevision: { include: { part: true } } } },
      pfmeaProcessSteps: {
        orderBy: { sortOrder: "asc" },
        include: { rows: { orderBy: { sortOrder: "asc" }, include: { responsible: true } } },
      },
    },
  });

  if (element.applicability === "NA") {
    return (
      <div className="mx-auto max-w-4xl bg-white p-6 text-black">
        <p className="text-sm">N/A — {element.naReason}</p>
      </div>
    );
  }

  const steps = element.pfmeaProcessSteps.filter((s) => s.rows.length > 0);

  // Chunk by whole steps (never split one across pages) so the "merged"
  // Process Step cell's rowSpan is always correct within a page.
  const pages: (typeof steps)[] = [];
  let current: typeof steps = [];
  let currentRows = 0;
  for (const step of steps) {
    if (currentRows > 0 && currentRows + step.rows.length > ROWS_PER_PAGE_TARGET) {
      pages.push(current);
      current = [];
      currentRows = 0;
    }
    current.push(step);
    currentRows += step.rows.length;
  }
  if (current.length > 0) pages.push(current);

  const part = element.ppap.partRevision.part;
  const footerEntries = [
    { label: "Prepared By", name: element.preparedBy?.name ?? null, date: element.preparedAt },
    { label: "Approved By", name: element.approvedBy?.name ?? null, date: element.approvedAt },
  ];

  return (
    <div className="bg-white text-black">
      <style>{`
        @page { size: A3 landscape; margin: 8mm; }
        @media print {
          .pfmea-print-page { page-break-after: always; }
          .pfmea-print-page:last-child { page-break-after: auto; }
        }
      `}</style>

      {pages.map((pageSteps, pageIndex) => (
        <div key={pageIndex} className="pfmea-print-page p-4">
          <table className="w-full border-collapse border border-black text-[7px]">
            <thead>
              <tr>
                <td colSpan={22} className="border border-black p-1 text-center font-semibold">
                  PFMEA - GENERAL PROCESS - Part Name: {part.partName}
                </td>
              </tr>
              <tr className="bg-muted/40">
                {[
                  "Process Step",
                  "Process Function",
                  "Potential Failure Mode",
                  "Potential Effect(s)",
                  "S",
                  "Potential Cause(s)",
                  "O",
                  "Current Prevention Controls",
                  "Current Detection Controls",
                  "D",
                  "RPN",
                  "AP",
                  "Recommended Actions",
                  "Responsible Person",
                  "Target Date",
                  "Action Taken",
                  "Rev. S",
                  "Rev. O",
                  "Rev. D",
                  "Rev. AP",
                  "Revision No",
                  "Revision Date",
                ].map((h) => (
                  <th key={h} className="border border-black p-1">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageSteps.map((step) =>
                step.rows.map((row, i) => {
                  const rpn = row.severity && row.occurrence && row.detection ? calculateRpn(row.severity, row.occurrence, row.detection) : null;
                  const ap = row.severity && row.occurrence && row.detection ? calculateActionPriority(row.severity, row.occurrence, row.detection) : null;
                  const revAp = row.revisedSeverity && row.revisedOccurrence && row.revisedDetection ? calculateActionPriority(row.revisedSeverity, row.revisedOccurrence, row.revisedDetection) : null;
                  return (
                    <tr key={row.id}>
                      {i === 0 ? (
                        <td rowSpan={step.rows.length} className="border border-black p-1 align-top font-medium">
                          {step.name}
                        </td>
                      ) : null}
                      <td className="border border-black p-1">{row.processFunction || "-"}</td>
                      <td className="border border-black p-1">{row.potentialFailureMode || "-"}</td>
                      <td className="border border-black p-1">{row.potentialEffect || "-"}</td>
                      <td className="border border-black p-1 text-center">{row.severity ?? "-"}</td>
                      <td className="border border-black p-1">{row.potentialCause || "-"}</td>
                      <td className="border border-black p-1 text-center">{row.occurrence ?? "-"}</td>
                      <td className="border border-black p-1">{row.currentPreventionControls || "-"}</td>
                      <td className="border border-black p-1">{row.currentDetectionControls || "-"}</td>
                      <td className="border border-black p-1 text-center">{row.detection ?? "-"}</td>
                      <td className="border border-black p-1 text-center font-medium">{rpn ?? "-"}</td>
                      <td className="border border-black p-1 text-center font-medium">{ap ?? "-"}</td>
                      <td className="border border-black p-1">{row.recommendedActions || "-"}</td>
                      <td className="border border-black p-1">{row.responsible?.name ?? row.responsibleText ?? "-"}</td>
                      <td className="border border-black p-1">{row.targetDate ? formatDateIndia(row.targetDate) : "-"}</td>
                      <td className="border border-black p-1">{row.actionTaken || "-"}</td>
                      <td className="border border-black p-1 text-center">{row.revisedSeverity ?? "-"}</td>
                      <td className="border border-black p-1 text-center">{row.revisedOccurrence ?? "-"}</td>
                      <td className="border border-black p-1 text-center">{row.revisedDetection ?? "-"}</td>
                      <td className="border border-black p-1 text-center font-medium">{revAp ?? "-"}</td>
                      <td className="border border-black p-1">{row.revisionNo || "-"}</td>
                      <td className="border border-black p-1">{row.revisionDate ? formatDateIndia(row.revisionDate) : "-"}</td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>

          <PrintFooter entries={footerEntries} />
          <table className="mt-1 w-full border-collapse border border-black text-[9px]">
            <tbody>
              <tr>
                <td className="border border-black p-1">Doc No : {element.docNo}</td>
                <td className="border border-black p-1">
                  Sheet {pageIndex + 1} of {pages.length}
                </td>
                <td className="border border-black p-1">Date: {formatDateIndia(new Date())}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}

      {pages.length === 0 ? (
        <div className="p-4 text-center text-sm text-muted-foreground">No PFMEA rows recorded.</div>
      ) : null}
    </div>
  );
}
