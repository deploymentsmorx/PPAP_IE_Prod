import { prisma } from "@/lib/prisma";
import { formatDateIndia } from "@/lib/format";
import { ensureAarCriteriaRows, getSupplierForHeader } from "@/lib/aar";
import { getSppSampleIdsForPpap } from "@/lib/spp";
import { PrintHeader } from "@/components/print-header";

const cell = "border border-black p-1";
const labelCell = `${cell} font-medium`;
const sectionCell = `${cell} bg-gray-100 font-semibold`;

/** "☑ New Part" / "☐ New Part", as the sheet's tick boxes. */
function Tick({ on, label }: { on: boolean; label: string }) {
  return (
    <div>
      {on ? "☑" : "☐"} {label}
    </div>
  );
}

const DISPOSITION_LABEL: Record<string, string> = { APPROVED: "Approved", REJECTED: "Rejected", CONDITIONAL: "Conditionally approved" };

/** Mirrors the reference sheet "13. AAR" (portrait), sections 1-6. */
export async function AarPrint({ ppapId }: { ppapId: string }) {
  const ppap = await prisma.ppap.findUniqueOrThrow({
    where: { id: ppapId },
    include: { customer: true, partRevision: { include: { part: true } } },
  });
  const { id: elementId } = await prisma.ppapElement.findUniqueOrThrow({ where: { ppapId_elementNo: { ppapId, elementNo: 13 } } });
  await ensureAarCriteriaRows(elementId, ppapId);
  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { id: elementId },
    include: {
      preparedBy: true,
      checkedBy: true,
      approvedBy: true,
      aarDetail: true,
      aarCriteriaRows: { orderBy: { sortOrder: "asc" }, include: { photos: { orderBy: { uploadedAt: "asc" } } } },
      customerDisposition: true,
    },
  });
  const supplier = await getSupplierForHeader();
  const sppSampleIds = await getSppSampleIdsForPpap(ppapId);
  const d = element.aarDetail;
  const cd = element.customerDisposition;
  const part = ppap.partRevision.part;
  const photos = element.aarCriteriaRows.flatMap((r) => r.photos.map((p) => ({ ...p, parameter: r.parameter })));

  return (
    <div className="mx-auto max-w-4xl bg-white p-6 text-black print:p-0">
      <style>{`@page { size: A4 portrait; margin: 10mm; }`}</style>
      <PrintHeader supplierName="Ingenious Engineering" title="PPAP DOCUMENTS" subtitle="AAR" docNo={element.docNo} revision={element.revision} />

      <div className="mt-2 border border-black p-1 text-center text-sm font-semibold">APPEARANCE APPROVAL REPORT (AAR)</div>

      {element.applicability === "NA" ? (
        <p className="mt-4 text-sm">N/A — {element.naReason}</p>
      ) : (
        <>
          {/* 1. Header */}
          <table className="mt-2 w-full border-collapse border border-black text-[10px]">
            <tbody>
              <tr>
                <td className={sectionCell} colSpan={4}>
                  1. Header Information
                </td>
              </tr>
              <tr>
                <td className={labelCell}>Supplier Name:</td>
                <td className={cell}>{supplier.name}</td>
                <td className={labelCell}>Submission Level</td>
                <td className={cell}>Level-{ppap.level}</td>
              </tr>
              <tr>
                <td className={labelCell}>Supplier Code:</td>
                <td className={cell}>{supplier.code ?? "-"}</td>
                <td className={labelCell}>Reason for Submission:</td>
                <td className={cell}>{ppap.reasonForSubmission ?? "-"}</td>
              </tr>
              <tr>
                <td className={labelCell}>Customer Name:</td>
                <td className={cell}>{ppap.customer.name}</td>
                <td className={cell} colSpan={2} rowSpan={4}>
                  <Tick on={d?.submissionReason === "NEW_PART"} label="New Part" />
                  <Tick on={d?.submissionReason === "ENGINEERING_CHANGE"} label="Engineering Change" />
                  <Tick on={d?.submissionReason === "TOOLING_CHANGE"} label="Tooling Change" />
                  <Tick on={d?.submissionReason === "SUPPLIER_CHANGE"} label="Supplier Change" />
                  <Tick
                    on={d?.submissionReason === "OTHER"}
                    label={`Other (Specify)${d?.submissionReason === "OTHER" && d.submissionReasonOther ? `: ${d.submissionReasonOther}` : ""}`}
                  />
                </td>
              </tr>
              <tr>
                <td className={labelCell}>Part Name:</td>
                <td className={cell}>{part.partName}</td>
              </tr>
              <tr>
                <td className={labelCell}>Part Number:</td>
                <td className={cell}>{part.partNumber}</td>
              </tr>
              <tr>
                <td className={labelCell}>Revision Level:</td>
                <td className={cell}>{ppap.partRevision.revision}</td>
              </tr>
              <tr>
                <td className={labelCell}>Date:</td>
                <td className={cell} colSpan={3}>
                  {d?.reportDate ? formatDateIndia(d.reportDate) : "-"}
                </td>
              </tr>
            </tbody>
          </table>

          {/* 2. Appearance criteria */}
          <table className="mt-2 w-full border-collapse border border-black text-[10px]">
            <thead>
              <tr>
                <td className={sectionCell} colSpan={6}>
                  2. Appearance Criteria Details
                </td>
              </tr>
              <tr>
                <th className={cell}>Sl. No</th>
                <th className={cell}>Appearance Parameter</th>
                <th className={cell}>Specification / Standard</th>
                <th className={cell}>Evaluation Method</th>
                <th className={cell}>Acceptance Criteria</th>
                <th className={cell}>Result</th>
              </tr>
            </thead>
            <tbody>
              {element.aarCriteriaRows.map((r, i) => (
                <tr key={r.id}>
                  <td className={`${cell} text-center`}>{i + 1}</td>
                  <td className={cell}>{r.parameter}</td>
                  <td className={cell}>{r.specification || "-"}</td>
                  <td className={cell}>{r.evaluationMethod || "-"}</td>
                  <td className={cell}>{r.acceptanceCriteria || "-"}</td>
                  <td className={cell}>{r.result || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 3. Sample info + 4. Master sample */}
          <table className="mt-2 w-full border-collapse border border-black text-[10px]">
            <tbody>
              <tr>
                <td className={sectionCell} colSpan={2}>
                  3. Sample Information
                </td>
              </tr>
              <tr>
                <td className={`${labelCell} w-1/2`}>Sample Size:</td>
                <td className={cell}>{d?.sampleSize || "-"}</td>
              </tr>
              <tr>
                <td className={labelCell}>No. of Samples Evaluated:</td>
                <td className={cell}>{d?.samplesEvaluated || "-"}</td>
              </tr>
              <tr>
                <td className={labelCell}>Sample Identification / Batch No.:</td>
                <td className={cell}>{d?.sampleIds || sppSampleIds || "-"}</td>
              </tr>
              <tr>
                <td className={labelCell}>Production Condition:</td>
                <td className={cell}>
                  <Tick on={d?.productionCondition === "PROTOTYPE"} label="Prototype" />
                  <Tick on={d?.productionCondition === "TRIAL_RUN"} label="Trial Run" />
                  <Tick on={d?.productionCondition === "MASS_PRODUCTION"} label="Mass Production" />
                </td>
              </tr>
              <tr>
                <td className={sectionCell} colSpan={2}>
                  4. Master Sample Reference
                </td>
              </tr>
              <tr>
                <td className={labelCell}>Master Sample No.:</td>
                <td className={cell}>{d?.masterSampleNo || "-"}</td>
              </tr>
              <tr>
                <td className={labelCell}>Approved by:</td>
                <td className={cell}>{d?.masterSampleApprovedBy || "-"}</td>
              </tr>
              <tr>
                <td className={labelCell}>Approval Date:</td>
                <td className={cell}>{d?.masterSampleApprovalDate ? formatDateIndia(d.masterSampleApprovalDate) : "-"}</td>
              </tr>
              <tr>
                <td className={labelCell}>Retained Location:</td>
                <td className={cell}>{d?.masterSampleLocation || "-"}</td>
              </tr>
            </tbody>
          </table>

          {/* 5. Evaluation summary | 6. Approval (side by side, as on the sheet) */}
          <table className="mt-2 w-full border-collapse border border-black text-[10px]">
            <tbody>
              <tr>
                <td className={`${sectionCell} w-1/2`}>5. Evaluation Summary</td>
                <td className={sectionCell} colSpan={4}>
                  6. Approval Section
                </td>
              </tr>
              <tr>
                <td className={`${cell} align-top`} rowSpan={4}>
                  <div className="font-medium">Overall Result:</div>
                  <Tick on={d?.overallResult === "APPROVED"} label="Approved" />
                  <Tick on={d?.overallResult === "CONDITIONALLY_APPROVED"} label="Conditionally Approved" />
                  <Tick on={d?.overallResult === "REJECTED"} label="Rejected" />
                  <div className="mt-1 font-medium">Deviation Details (if any):</div>
                  <div className="whitespace-pre-wrap">{d?.deviationDetails || "-"}</div>
                  <div className="mt-1 font-medium">Corrective Action Plan:</div>
                  <div className="whitespace-pre-wrap">{d?.correctiveActionPlan || "-"}</div>
                </td>
                <th className={cell}>Function</th>
                <th className={cell}>Name</th>
                <th className={cell}>Sign</th>
                <th className={cell}>Date</th>
              </tr>
              <tr>
                <td className={labelCell}>Prepared By (Supplier QA)</td>
                <td className={cell}>{element.preparedBy?.name ?? ""}</td>
                <td className={`${cell} h-8`} />
                <td className={cell}>{element.preparedAt ? formatDateIndia(element.preparedAt) : ""}</td>
              </tr>
              <tr>
                <td className={labelCell}>Reviewed By</td>
                <td className={cell}>{element.checkedBy?.name ?? ""}</td>
                <td className={`${cell} h-8`} />
                <td className={cell}>{element.checkedAt ? formatDateIndia(element.checkedAt) : ""}</td>
              </tr>
              <tr>
                <td className={`${labelCell} align-top`}>
                  Customer Approval
                  <div className="font-normal">{cd?.status ? DISPOSITION_LABEL[cd.status] : ""}</div>
                </td>
                <td className={`${cell} align-top`}>
                  {cd?.customerName ?? ""}
                  {cd?.customerDesignation ? <div>{cd.customerDesignation}</div> : null}
                </td>
                <td className={`${cell} h-8`} />
                <td className={`${cell} align-top`}>{cd?.customerSignatureDate ? formatDateIndia(cd.customerSignatureDate) : ""}</td>
              </tr>
              <tr>
                <td className={cell} />
                <td className={cell} colSpan={4}>
                  <span className="font-medium">(Customer Comments):</span> {cd?.comments ?? ""}
                </td>
              </tr>
            </tbody>
          </table>

          {photos.length > 0 ? (
            <div className="mt-3 break-inside-avoid">
              <div className="text-[10px] font-semibold">Photo Evidence</div>
              <div className="mt-1 grid grid-cols-4 gap-2">
                {photos.map((p) => (
                  <figure key={p.id} className="text-[9px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.fileUrl} alt={`${p.parameter} evidence`} className="h-24 w-full border border-black object-cover" />
                    <figcaption>{p.parameter}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
