import { prisma } from "@/lib/prisma";
import { PrintHeader } from "@/components/print-header";
import { PrintFooter } from "@/components/print-footer";

export async function DesignRecordPrint({ ppapId }: { ppapId: string }) {
  const ppap = await prisma.ppap.findUniqueOrThrow({
    where: { id: ppapId },
    include: { customer: true, partRevision: { include: { part: true } } },
  });

  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { ppapId_elementNo: { ppapId, elementNo: 1 } },
    include: {
      preparedBy: true,
      approvedBy: true,
      designRecordDetail: { include: { materialSpec: true } },
    },
  });

  const detail = element.designRecordDetail;

  const rows: { no: number; particular: string; details: string; remarks: string }[] = [
    { no: 1, particular: "Part Name", details: ppap.partRevision.part.partName, remarks: detail?.partNameRemarks ?? "" },
    { no: 2, particular: "Part Number", details: ppap.partRevision.part.partNumber, remarks: detail?.partNumberRemarks ?? "" },
    { no: 3, particular: "Customer Name", details: ppap.customer.name, remarks: detail?.customerNameRemarks ?? "" },
    { no: 4, particular: "Drawing Number", details: ppap.partRevision.drawingNo ?? "", remarks: detail?.drawingNumberRemarks ?? "" },
    { no: 5, particular: "Drawing Revision", details: ppap.partRevision.revision, remarks: detail?.drawingRevisionRemarks ?? "" },
    {
      no: 6,
      particular: "Material Specification",
      details: detail?.materialSpec ? `${detail.materialSpec.standard} ${detail.materialSpec.grade}` : "",
      remarks: detail?.materialSpecRemarks ?? "",
    },
    { no: 7, particular: "Heat Treatment", details: detail?.heatTreatment ?? "-", remarks: detail?.heatTreatmentRemarks ?? "" },
    { no: 8, particular: "Surface Finish", details: detail?.surfaceFinish ?? "-", remarks: detail?.surfaceFinishRemarks ?? "" },
    { no: 9, particular: "Special Characteristics", details: "-", remarks: detail?.specialCharacteristicsRemarks ?? "" },
  ];

  return (
    <div className="mx-auto max-w-4xl bg-white p-6 text-black print:p-0">
      <PrintHeader
        supplierName="Ingenious Engineering"
        title="PPAP DOCUMENTS"
        subtitle="DESIGN RECORD"
        docNo={element.docNo}
        revision={element.revision}
      />

      <table className="mt-2 w-full border-collapse border border-black text-xs">
        <thead>
          <tr>
            <th className="border border-black p-2">Sl. No.</th>
            <th className="border border-black p-2">Particular</th>
            <th className="border border-black p-2">Details</th>
            <th className="border border-black p-2">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.no}>
              <td className="border border-black p-2 text-center">{r.no}</td>
              <td className="border border-black p-2">{r.particular}</td>
              <td className="border border-black p-2">{r.details || "-"}</td>
              <td className="border border-black p-2">{r.remarks || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <PrintFooter
        entries={[
          { label: "Prepared By", name: element.preparedBy?.name ?? null, date: element.preparedAt },
          { label: "Approved By", name: element.approvedBy?.name ?? null, date: element.approvedAt },
        ]}
      />
    </div>
  );
}
