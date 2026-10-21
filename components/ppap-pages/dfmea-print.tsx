import { prisma } from "@/lib/prisma";
import { formatDateIndia } from "@/lib/format";
import { calculateRpn } from "@/lib/calc/fmea";
import { PrintHeader } from "@/components/print-header";
import { PrintFooter } from "@/components/print-footer";

export async function DfmeaPrint({ ppapId }: { ppapId: string }) {
  const ppap = await prisma.ppap.findUniqueOrThrow({
    where: { id: ppapId },
    include: { customer: true, partRevision: { include: { part: true } } },
  });

  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { ppapId_elementNo: { ppapId, elementNo: 4 } },
    include: {
      preparedBy: true,
      checkedBy: true,
      approvedBy: true,
      dfmeaDetail: {
        include: { rows: { include: { responsible: true }, orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  const detail = element.dfmeaDetail;
  const rows = detail?.rows ?? [];

  return (
    <div className="mx-auto max-w-[1400px] bg-white p-6 text-black print:p-0">
      <PrintHeader
        supplierName="Ingenious Engineering"
        title="DESIGN FAILURE MODE AND EFFECTS ANALYSIS (DFMEA)"
        subtitle={`${ppap.customer.name} — ${ppap.partRevision.part.partName} (${ppap.partRevision.part.partNumber})`}
        docNo={element.docNo}
        revision={element.revision}
      />

      {element.applicability === "NA" ? (
        <p className="mt-4 text-sm">{element.naReason || "Design Not In Our Scope"}</p>
      ) : (
        <>
          <table className="mt-3 w-full border-collapse border border-black text-[10px]">
            <tbody>
              <tr>
                <td className="border border-black p-1 font-medium">DFMEA Ref.</td>
                <td className="border border-black p-1">{detail?.dfmeaRef || "-"}</td>
                <td className="border border-black p-1 font-medium">Start Date</td>
                <td className="border border-black p-1">
                  {detail?.startDate ? formatDateIndia(detail.startDate) : "-"}
                </td>
                <td className="border border-black p-1 font-medium">Revision</td>
                <td className="border border-black p-1">{detail?.revision || "-"}</td>
                <td className="border border-black p-1 font-medium">Design Responsibility</td>
                <td className="border border-black p-1">{detail?.designResponsibility || "-"}</td>
              </tr>
            </tbody>
          </table>

          <table className="mt-2 w-full border-collapse border border-black text-[9px]">
            <thead>
              <tr className="bg-muted/40">
                <th className="border border-black p-1">Item/Function</th>
                <th className="border border-black p-1">Potential Failure Mode</th>
                <th className="border border-black p-1">Effects</th>
                <th className="border border-black p-1">S</th>
                <th className="border border-black p-1">Causes</th>
                <th className="border border-black p-1">O</th>
                <th className="border border-black p-1">Current Controls (Prevention/Detection)</th>
                <th className="border border-black p-1">D</th>
                <th className="border border-black p-1">RPN</th>
                <th className="border border-black p-1">Recommended Actions</th>
                <th className="border border-black p-1">Responsibility</th>
                <th className="border border-black p-1">Target Date</th>
                <th className="border border-black p-1">Action Taken</th>
                <th className="border border-black p-1">Rev. S</th>
                <th className="border border-black p-1">Rev. O</th>
                <th className="border border-black p-1">Rev. D</th>
                <th className="border border-black p-1">Rev. RPN</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const rpn =
                  row.severity && row.occurrence && row.detection
                    ? calculateRpn(row.severity, row.occurrence, row.detection)
                    : null;
                const revRpn =
                  row.revisedSeverity && row.revisedOccurrence && row.revisedDetection
                    ? calculateRpn(row.revisedSeverity, row.revisedOccurrence, row.revisedDetection)
                    : null;
                return (
                  <tr key={row.id}>
                    <td className="border border-black p-1">{row.item || "-"}</td>
                    <td className="border border-black p-1">{row.potentialFailureMode || "-"}</td>
                    <td className="border border-black p-1">{row.effects || "-"}</td>
                    <td className="border border-black p-1 text-center">{row.severity ?? "-"}</td>
                    <td className="border border-black p-1">{row.causes || "-"}</td>
                    <td className="border border-black p-1 text-center">{row.occurrence ?? "-"}</td>
                    <td className="border border-black p-1">
                      {[row.currentControlsPrevention, row.currentControlsDetection].filter(Boolean).join(" / ") || "-"}
                    </td>
                    <td className="border border-black p-1 text-center">{row.detection ?? "-"}</td>
                    <td className="border border-black p-1 text-center font-medium">{rpn ?? "-"}</td>
                    <td className="border border-black p-1">{row.recommendedActions || "-"}</td>
                    <td className="border border-black p-1">{row.responsible?.name || "-"}</td>
                    <td className="border border-black p-1">
                      {row.targetDate ? formatDateIndia(row.targetDate) : "-"}
                    </td>
                    <td className="border border-black p-1">{row.actionTaken || "-"}</td>
                    <td className="border border-black p-1 text-center">{row.revisedSeverity ?? "-"}</td>
                    <td className="border border-black p-1 text-center">{row.revisedOccurrence ?? "-"}</td>
                    <td className="border border-black p-1 text-center">{row.revisedDetection ?? "-"}</td>
                    <td className="border border-black p-1 text-center font-medium">{revRpn ?? "-"}</td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={17} className="border border-black p-2 text-center">
                    No DFMEA rows recorded.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
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
