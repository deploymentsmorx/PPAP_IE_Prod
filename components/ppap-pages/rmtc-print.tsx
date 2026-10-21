import { prisma } from "@/lib/prisma";
import { displayCompanyName } from "@/lib/brand";
import { formatDateIndia } from "@/lib/format";
import { computePlateFlags } from "@/lib/calc/plate";

export async function RmtcPrint({ ppapId }: { ppapId: string }) {
  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { ppapId_elementNo: { ppapId, elementNo: 10 } },
    include: {
      preparedBy: true,
      checkedBy: true,
      approvedBy: true,
      ppap: { include: { customer: true, partRevision: { include: { part: true } } } },
      rmtcReportDetail: {
        include: { rows: { orderBy: { sortOrder: "asc" }, include: { materialSpec: true } } },
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

  const detail = element.rmtcReportDetail;
  const rows = detail?.rows ?? [];
  const part = element.ppap.partRevision.part;
  const tolerance = {
    thicknessMm: detail?.thicknessToleranceMm != null ? Number(detail.thicknessToleranceMm) : 0.3,
    widthMm: detail?.widthToleranceMm != null ? Number(detail.widthToleranceMm) : 30,
    lengthMm: detail?.lengthToleranceMm != null ? Number(detail.lengthToleranceMm) : 30,
  };

  return (
    <div className="bg-white p-4 text-black">
      <style>{`@page { size: A4 landscape; margin: 8mm; }`}</style>
      <table className="w-full border-collapse border border-black text-[9px]">
        <tbody>
          <tr>
            <td className="border border-black p-1" colSpan={5}>
              Smorx
            </td>
            <td className="border border-black p-1" colSpan={6}>
              Material Performance Test Results (RM Test Reports)
            </td>
            <td className="border border-black p-1" colSpan={2}>
              Doc No: {element.docNo ?? "-"}
            </td>
          </tr>
          <tr>
            <td className="border border-black p-1 font-medium">Customer Name:</td>
            <td className="border border-black p-1" colSpan={2}>
              {element.ppap.customer.name}
            </td>
            <td className="border border-black p-1 font-medium">Project Name:</td>
            <td className="border border-black p-1" colSpan={2}>
              {detail?.projectName || "-"}
            </td>
            <td className="border border-black p-1 font-medium">Drawing Rev. No.</td>
            <td className="border border-black p-1" colSpan={2}>
              Revision - {element.ppap.partRevision.revision}
            </td>
            <td className="border border-black p-1 font-medium">Prepared By:</td>
            <td className="border border-black p-1" colSpan={2}>
              {element.preparedBy?.name ?? "-"}
            </td>
          </tr>
          <tr>
            <td className="border border-black p-1 font-medium">Supplier Name:</td>
            <td className="border border-black p-1" colSpan={2}>
              {displayCompanyName(detail?.supplierName)}
            </td>
            <td className="border border-black p-1 font-medium">Part Name:</td>
            <td className="border border-black p-1" colSpan={2}>
              {part.partName}
            </td>
            <td className="border border-black p-1 font-medium">Other ref. If any</td>
            <td className="border border-black p-1" colSpan={2}>
              {detail?.otherRef || "-"}
            </td>
            <td className="border border-black p-1 font-medium">Approved by:</td>
            <td className="border border-black p-1" colSpan={2}>
              {element.approvedBy?.name ?? "-"}
            </td>
          </tr>
          <tr>
            <td className="border border-black p-1 font-medium">Code No:</td>
            <td className="border border-black p-1" colSpan={2}>
              {detail?.codeNo || "-"}
            </td>
            <td className="border border-black p-1 font-medium">Part Number:</td>
            <td className="border border-black p-1" colSpan={2}>
              {part.partNumber}
            </td>
            <td className="border border-black p-1" colSpan={2}></td>
            <td className="border border-black p-1 font-medium">Date:</td>
            <td className="border border-black p-1" colSpan={2}>
              {element.preparedAt ? formatDateIndia(element.preparedAt) : "-"}
            </td>
          </tr>
          <tr>
            <td className="border border-black p-1 text-center font-semibold" colSpan={13}>
              RAW MATERIAL DETAILS
            </td>
          </tr>
          <tr className="bg-muted/40">
            <th className="border border-black p-1">Sl. No.</th>
            <th className="border border-black p-1">Part No</th>
            <th className="border border-black p-1">Material Specification / Grade</th>
            <th className="border border-black p-1">Required Size as per PO</th>
            <th className="border border-black p-1">Qty. (Nos.)</th>
            <th className="border border-black p-1">Observed material Size</th>
            <th className="border border-black p-1">Mill T.C No. and Date</th>
            <th className="border border-black p-1">Heat No</th>
            <th className="border border-black p-1">Plate No</th>
            <th className="border border-black p-1">Material Identification Number</th>
            <th className="border border-black p-1">Lab Report No.</th>
            <th className="border border-black p-1" colSpan={2}>
              Remarks
            </th>
          </tr>
          {rows.map((row) => {
            const flag = computePlateFlags(row.requiredSizeText, row.observedSizeText, tolerance);
            const materialSpecLabel = row.materialSpec ? `${row.materialSpec.standard} ${row.materialSpec.grade}` : row.materialSpecText || "-";
            return (
              <tr key={row.id}>
                <td className="border border-black p-1">{row.slNo}</td>
                <td className="border border-black p-1">{row.partNo || "-"}</td>
                <td className="border border-black p-1">{materialSpecLabel}</td>
                <td className="border border-black p-1">{row.requiredSizeText || "-"}</td>
                <td className="border border-black p-1 text-center">{row.qtyNos ?? "-"}</td>
                <td className={`border border-black p-1 ${flag.flagged ? "bg-red-200 font-semibold" : ""}`}>{row.observedSizeText || "-"}</td>
                <td className="border border-black p-1 whitespace-pre-line">
                  {row.millTcNo || "-"}
                  {row.millTcDate ? `\n${formatDateIndia(row.millTcDate)}` : ""}
                </td>
                <td className="border border-black p-1">{row.heatNo || "-"}</td>
                <td className="border border-black p-1">{row.plateNo || "-"}</td>
                <td className="border border-black p-1">{row.materialIdNo || "-"}</td>
                <td className="border border-black p-1">{row.labReportNo || "-"}</td>
                <td className="border border-black p-1" colSpan={2}>
                  {row.remarks || "-"}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={13} className="border border-black p-2 text-center">
                No raw material lots recorded.
              </td>
            </tr>
          ) : null}
          <tr>
            <td className="border border-black p-1 font-medium" colSpan={13}>
              Remarks: {detail?.reportRemarks || ""}
            </td>
          </tr>
          <tr>
            <td className="border border-black p-1 text-center font-medium" colSpan={4}>
              Checked by:
            </td>
            <td className="border border-black p-1 text-center font-medium" colSpan={5}>
              Approved by:
            </td>
            <td className="border border-black p-1 text-center font-medium" colSpan={4}>
              Customer Verification:
            </td>
          </tr>
          <tr>
            <td className="border border-black p-1 text-center" colSpan={4}>
              IE QA (Name &amp; Sign): {element.checkedBy?.name ?? "-"}
              {element.checkedAt ? ` — ${formatDateIndia(element.checkedAt)}` : ""}
            </td>
            <td className="border border-black p-1 text-center" colSpan={5}>
              IE QA HOD (Name &amp; Sign): {element.approvedBy?.name ?? "-"}
              {element.approvedAt ? ` — ${formatDateIndia(element.approvedAt)}` : ""}
            </td>
            <td className="border border-black p-1 text-center" colSpan={4}>
              Customer Witness (Name &amp; Sign): {detail?.customerWitnessName || "-"}
              {detail?.customerWitnessAt ? ` — ${formatDateIndia(detail.customerWitnessAt)}` : ""}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
