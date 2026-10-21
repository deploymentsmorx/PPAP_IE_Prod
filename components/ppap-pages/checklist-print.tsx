import { prisma } from "@/lib/prisma";
import { PPAP_ELEMENT_NAMES } from "@/lib/constants/ppap-elements";
import { formatDateIndia } from "@/lib/format";
import { PrintHeader } from "@/components/print-header";
import { PrintFooter } from "@/components/print-footer";

const CHECKLIST_ELEMENT_NUMBERS = Array.from({ length: 18 }, (_, i) => i + 1);

export async function ChecklistPrint({ ppapId }: { ppapId: string }) {
  const ppap = await prisma.ppap.findUniqueOrThrow({
    where: { id: ppapId },
    include: { customer: true, partRevision: { include: { part: true } } },
  });

  const element0 = await prisma.ppapElement.findUniqueOrThrow({
    where: { ppapId_elementNo: { ppapId, elementNo: 0 } },
    include: { preparedBy: true, checkedBy: true, approvedBy: true },
  });

  const checklistRows = await prisma.checklistRow.findMany({ where: { ppapId } });
  const rowByElementNo = new Map(checklistRows.map((r) => [r.elementNo, r]));

  return (
    <div className="mx-auto max-w-5xl bg-white p-6 text-black print:p-0">
      <PrintHeader
        supplierName="Smorx"
        title="PPAP DOCUMENTS"
        subtitle="PPAP CHECK LIST"
        docNo={element0.docNo}
        revision={element0.revision}
      />

      <table className="mt-2 w-full border-collapse border border-black text-xs">
        <thead>
          <tr>
            <th className="border border-black p-2">Sl No</th>
            <th className="border border-black p-2">PPAP Element</th>
            <th className="border border-black p-2">Required (Y/N)</th>
            <th className="border border-black p-2">Status (OK/NG)</th>
            <th className="border border-black p-2">Remarks</th>
            <th className="border border-black p-2">Document Reference</th>
          </tr>
        </thead>
        <tbody>
          {CHECKLIST_ELEMENT_NUMBERS.map((elementNo) => {
            const row = rowByElementNo.get(elementNo);
            return (
              <tr key={elementNo}>
                <td className="border border-black p-2 text-center">{elementNo}</td>
                <td className="border border-black p-2">{PPAP_ELEMENT_NAMES[elementNo]}</td>
                <td className="border border-black p-2 text-center">{row?.requiredOverride || "-"}</td>
                <td className="border border-black p-2 text-center">{row?.statusOverride || "-"}</td>
                <td className="border border-black p-2">{row?.remarks || "-"}</td>
                <td className="border border-black p-2">{row?.docRefLabel || "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <table className="mt-4 w-full border-collapse border border-black text-xs">
        <tbody>
          <tr>
            <td className="border border-black p-2 font-semibold">Part Name:</td>
            <td className="border border-black p-2">{ppap.partRevision.part.partName}</td>
            <td className="border border-black p-2 font-semibold">Part Number:</td>
            <td className="border border-black p-2">
              {ppap.partRevision.part.partNumber} Rev.{ppap.partRevision.revision}
            </td>
          </tr>
          <tr>
            <td className="border border-black p-2 font-semibold">Customer:</td>
            <td className="border border-black p-2" colSpan={3}>
              {ppap.customer.name}
            </td>
          </tr>
        </tbody>
      </table>

      <PrintFooter
        entries={[
          { label: "Prepared By", name: element0.preparedBy?.name ?? null, date: element0.preparedAt },
          { label: "Checked By", name: element0.checkedBy?.name ?? null, date: element0.checkedAt },
          { label: "Approved By", name: element0.approvedBy?.name ?? null, date: element0.approvedAt },
        ]}
      />
      <p className="mt-2 text-xs">Date: {formatDateIndia(ppap.submissionDate)}</p>
    </div>
  );
}
