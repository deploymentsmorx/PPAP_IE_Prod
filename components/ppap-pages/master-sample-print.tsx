import { prisma } from "@/lib/prisma";
import { formatDateIndia } from "@/lib/format";
import { masterSampleExpiry } from "@/lib/calc/master-sample";
import { PrintHeader } from "@/components/print-header";
import { PrintFooter } from "@/components/print-footer";

const cell = "border border-black p-1 align-top";
const STATUS_LABEL = { ACTIVE: "Active", SUPERSEDED: "Superseded", DISPOSED: "Disposed" } as const;

/**
 * Mirrors the reference sheet "15. Master Sample" (portrait): register
 * columns (plus the computed Expiry), the "Image Ref." area, and the
 * Prepared By / Approved By footer.
 */
export async function MasterSamplePrint({ ppapId }: { ppapId: string }) {
  const ppap = await prisma.ppap.findUniqueOrThrow({
    where: { id: ppapId },
    include: { customer: true, partRevision: { include: { part: true } } },
  });
  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { ppapId_elementNo: { ppapId, elementNo: 15 } },
    include: {
      preparedBy: true,
      approvedBy: true,
      masterSamples: { orderBy: { sortOrder: "asc" }, include: { images: { orderBy: { uploadedAt: "asc" } } } },
    },
  });
  const part = ppap.partRevision.part;
  const images = element.masterSamples.flatMap((r) => r.images.map((img) => ({ ...img, sampleId: r.sampleId })));

  return (
    <div className="mx-auto max-w-4xl bg-white p-6 text-black print:p-0">
      <style>{`@page { size: A4 portrait; margin: 10mm; }`}</style>
      <PrintHeader supplierName="Smorx" title="PPAP DOCUMENTS" subtitle="MASTER SAMPLE" docNo={element.docNo} revision={element.revision} />

      {element.applicability === "NA" ? (
        <p className="mt-4 text-sm">N/A — {element.naReason}</p>
      ) : (
        <>
          <table className="mt-2 w-full border-collapse border border-black text-[9px]">
            <thead>
              <tr className="bg-gray-100">
                {[
                  "Part Name",
                  "Part No",
                  "Customer",
                  "Drawing No",
                  "Rev",
                  "PPAP Level",
                  "Approval Date",
                  "Sample ID",
                  "Storage Location",
                  "Retention Period",
                  "Expiry",
                  "Status",
                  "Remarks",
                ].map((h) => (
                  <th key={h} className={cell}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {element.masterSamples.length === 0 ? (
                <tr>
                  <td className={cell} colSpan={13}>
                    No master samples registered.
                  </td>
                </tr>
              ) : (
                element.masterSamples.map((r) => {
                  const expiry = masterSampleExpiry(r.approvalDate, r.retentionYears);
                  return (
                    <tr key={r.id}>
                      <td className={cell}>{part.partName}</td>
                      <td className={cell}>{part.partNumber}</td>
                      <td className={cell}>{ppap.customer.name}</td>
                      <td className={cell}>{ppap.partRevision.drawingNo ?? part.partNumber}</td>
                      <td className={cell}>{ppap.partRevision.revision}</td>
                      <td className={cell}>L-{ppap.level}</td>
                      <td className={cell}>{r.approvalDate ? formatDateIndia(r.approvalDate) : "-"}</td>
                      <td className={cell}>{r.sampleId}</td>
                      <td className={cell}>{r.storageLocation ?? "-"}</td>
                      <td className={cell}>{r.retentionYears != null ? `${r.retentionYears} Years` : "-"}</td>
                      <td className={cell}>{expiry ? formatDateIndia(expiry) : "-"}</td>
                      <td className={cell}>{STATUS_LABEL[r.status]}</td>
                      <td className={cell}>{r.remarks ?? ""}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <div className="mt-2 min-h-48 border border-black p-2">
            <div className="text-[10px] font-semibold">Image Ref.</div>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {images.map((img) => (
                <figure key={img.id} className="text-[9px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.fileUrl} alt={`${img.sampleId} master sample`} className="h-36 w-full border border-black object-cover" />
                  <figcaption>{img.sampleId}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </>
      )}

      <PrintFooter
        entries={[
          { label: "Prepared By", name: element.preparedBy?.name ?? null, date: element.preparedAt },
          { label: "Approved By", name: element.approvedBy?.name ?? null, date: element.approvedAt },
        ]}
      />
    </div>
  );
}
