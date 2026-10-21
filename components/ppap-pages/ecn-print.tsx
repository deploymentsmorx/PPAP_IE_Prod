import { prisma } from "@/lib/prisma";
import { formatDateIndia } from "@/lib/format";
import { PrintHeader } from "@/components/print-header";
import { PrintFooter } from "@/components/print-footer";

export async function EcnPrint({ ppapId }: { ppapId: string }) {
  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { ppapId_elementNo: { ppapId, elementNo: 2 } },
    include: { preparedBy: true, checkedBy: true, approvedBy: true },
  });

  const ecns = await prisma.ecnRecord.findMany({
    where: { ppapElementId: element.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl bg-white p-6 text-black print:p-0">
      <PrintHeader
        supplierName="Smorx"
        title="PPAP DOCUMENTS"
        subtitle="ECN RECORD"
        docNo={element.docNo}
        revision={element.revision}
      />

      {element.applicability === "NA" ? (
        <p className="mt-4 text-sm">N/A — {element.naReason}</p>
      ) : (
        <table className="mt-2 w-full border-collapse border border-black text-xs">
          <thead>
            <tr>
              <th className="border border-black p-2">ECN No.</th>
              <th className="border border-black p-2">Date</th>
              <th className="border border-black p-2">Type</th>
              <th className="border border-black p-2">Reason</th>
              <th className="border border-black p-2">Stock Disposition</th>
              <th className="border border-black p-2">Implementation Date</th>
            </tr>
          </thead>
          <tbody>
            {ecns.map((ecn) => (
              <tr key={ecn.id}>
                <td className="border border-black p-2">{ecn.ecnNumber}</td>
                <td className="border border-black p-2">{ecn.ecnDate ? formatDateIndia(ecn.ecnDate) : "-"}</td>
                <td className="border border-black p-2">{ecn.changeType ?? "-"}</td>
                <td className="border border-black p-2">{ecn.reason ?? "-"}</td>
                <td className="border border-black p-2">{ecn.stockDisposition ?? "-"}</td>
                <td className="border border-black p-2">
                  {ecn.implementationDate ? formatDateIndia(ecn.implementationDate) : "-"}
                </td>
              </tr>
            ))}
            {ecns.length === 0 ? (
              <tr>
                <td className="border border-black p-2 text-center" colSpan={6}>
                  No ECNs logged.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      )}

      <PrintFooter
        entries={[
          { label: "Prepared By", name: element.preparedBy?.name ?? null, date: element.preparedAt },
          { label: "Reviewed By", name: element.checkedBy?.name ?? null, date: element.checkedAt },
          { label: "Approved By", name: element.approvedBy?.name ?? null, date: element.approvedAt },
        ]}
      />
    </div>
  );
}
