import { prisma } from "@/lib/prisma";
import { formatDateIndia } from "@/lib/format";
import { computeNumericStatus, formatRequirement } from "@/lib/calc/lab";
import { parseRangeText } from "@/lib/calc/tolerance";
import { PrintHeader } from "@/components/print-header";

// Row labels as written on the reference sheet "12. LAB Reports".
const MECHANICAL_LABEL: Record<string, string> = {
  YIELD_STRENGTH: "Yield Strength",
  UTS: "Ultimate Tensile Strength",
  ELONGATION: "Elongation%",
  HARDNESS: "Hardness",
  IMPACT: "Impact Energy",
};
const CHEMICAL_LABEL: Record<string, string> = { C: "C", MN: "Mn", SI: "Si", S: "S", P: "P", CR: "Cr", NI: "Ni", MO: "Mo", OTHER: "Other" };
const PAINT_LABEL: Record<string, string> = { DFT: "DFT", ADHESION: "Adhesion", GLOSS: "Glossy", VISUAL: "Visual Inspection" };

const MECHANICAL_ORDER = ["YIELD_STRENGTH", "UTS", "ELONGATION", "HARDNESS", "IMPACT"];
const CHEMICAL_ORDER = ["C", "MN", "SI", "S", "P", "CR", "NI", "MO", "OTHER"];
const PAINT_ORDER = ["DFT", "ADHESION", "GLOSS", "VISUAL"];

function byOrder<T>(rows: T[], key: (r: T) => string, order: string[]): T[] {
  return [...rows].sort((a, b) => order.indexOf(key(a)) - order.indexOf(key(b)));
}

const cell = "border border-black p-1";
const labelCell = `${cell} font-medium`;
const sectionCell = `${cell} bg-gray-100 font-semibold`;

function statusCell(status: string) {
  return status === "UNKNOWN" ? "-" : status;
}

type Signer = { name: string | null; signatureUrl: string | null } | null;

/**
 * Mirrors the reference sheet "12. LAB Reports" (portrait): header block,
 * a two-column report info block, Test Details, Mechanical Properties,
 * Chemical Analysis, Paint Details, and the Ingenious QA Verification
 * block (Verified = the Checked stage). One page per report.
 */
export async function LabPrint({ ppapId }: { ppapId: string }) {
  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { ppapId_elementNo: { ppapId, elementNo: 12 } },
    include: {
      preparedBy: true,
      checkedBy: true,
      approvedBy: true,
      ppap: { include: { customer: true, partRevision: { include: { part: true } } } },
      labReports: {
        orderBy: { sortOrder: "asc" },
        include: {
          lab: true,
          materialSpec: true,
          rmtcReportRow: true,
          testDetails: { orderBy: { sortOrder: "asc" } },
          mechanicalResults: true,
          chemicalResults: true,
          paintResults: true,
        },
      },
    },
  });

  const header = (
    <PrintHeader
      supplierName="Ingenious Engineering"
      title="PPAP DOCUMENTS"
      subtitle="LAB REPORTS"
      docNo={element.docNo}
      revision={element.revision}
    />
  );

  if (element.applicability === "NA") {
    return (
      <div className="mx-auto max-w-4xl bg-white p-6 text-black">
        {header}
        <p className="mt-3 text-sm">N/A — {element.naReason}</p>
      </div>
    );
  }

  const { ppap } = element;
  const part = ppap.partRevision.part;

  const verification: { label: string; signer: Signer; date: Date | null }[] = [
    { label: "Verified By", signer: element.checkedBy, date: element.checkedAt },
    { label: "Prepared By", signer: element.preparedBy, date: element.preparedAt },
    { label: "Approved By", signer: element.approvedBy, date: element.approvedAt },
  ];
  const verificationBlock = (
    <table className="mt-2 w-full border-collapse border border-black text-[10px]">
      <tbody>
        <tr>
          <td className={sectionCell} colSpan={4}>
            Ingenious QA Verification
          </td>
        </tr>
        <tr>
          <td className={labelCell} />
          {verification.map((v) => (
            <td key={v.label} className={labelCell}>
              {v.label}
            </td>
          ))}
        </tr>
        <tr>
          <td className={labelCell}>Signature</td>
          {verification.map((v) => (
            <td key={v.label} className={`${cell} h-10 align-bottom`}>
              {v.signer?.signatureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.signer.signatureUrl} alt={`${v.label} signature`} className="h-8" />
              ) : null}
              <div>{v.signer?.name ?? ""}</div>
            </td>
          ))}
        </tr>
        <tr>
          <td className={labelCell}>Date</td>
          {verification.map((v) => (
            <td key={v.label} className={cell}>
              {v.date ? formatDateIndia(v.date) : ""}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );

  return (
    <div className="bg-white text-black">
      <style>{`
        @page { size: A4 portrait; margin: 10mm; }
        @media print {
          .lab-print-page { page-break-after: always; }
          .lab-print-page:last-child { page-break-after: auto; }
        }
      `}</style>

      {element.labReports.length === 0 ? (
        <div className="mx-auto max-w-4xl p-4">
          {header}
          <p className="mt-3 text-sm">No lab reports recorded.</p>
          {verificationBlock}
        </div>
      ) : null}

      {element.labReports.map((report) => {
        const materialGrade = report.materialSpec ? `${report.materialSpec.standard} ${report.materialSpec.grade}` : report.materialGradeText;
        const heatBatchNo = report.rmtcReportRow?.heatNo || report.heatBatchNoText;
        const accreditation = report.lab ? [report.lab.accreditationBody, report.lab.certificateNo].filter(Boolean).join(" — ") : "";

        // Left/right label-value pairs, in the sheet's row order (rows 4-11).
        const info: [string, string, string, string][] = [
          ["Company Name", report.companyName || "-", "Part Number", part.partNumber],
          ["Lab Name", report.lab?.name || "-", "Drawing No", ppap.partRevision.drawingNo ?? part.partNumber],
          ["Lab Accreditation (ISO 17025 / NABL)", accreditation || "-", "Revision", ppap.partRevision.revision],
          ["Report No", report.reportNo || "-", "Material Grade", materialGrade || "-"],
          ["Test Date", report.testDate ? formatDateIndia(report.testDate) : "-", "Heat No / Batch No", heatBatchNo || "-"],
          ["PPAP Level", String(ppap.level), "Sample Qty", report.sampleQty != null ? String(report.sampleQty) : "-"],
          ["Customer Name", ppap.customer.name, "Manufacturing Process", report.manufacturingProcess || "-"],
          ["Part Name", part.partName, "Heat Treatment Status", report.heatTreatmentStatus || "-"],
        ];

        return (
          <div key={report.id} className="lab-print-page mx-auto max-w-4xl p-4">
            {header}

            <table className="mt-2 w-full border-collapse border border-black text-[10px]">
              <tbody>
                {info.map(([l1, v1, l2, v2]) => (
                  <tr key={l1}>
                    <td className={`${labelCell} w-1/4`}>{l1}</td>
                    <td className={`${cell} w-1/4`}>{v1}</td>
                    <td className={`${labelCell} w-1/4`}>{l2}</td>
                    <td className={`${cell} w-1/4`}>{v2}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <table className="mt-2 w-full border-collapse border border-black text-[10px]">
              <thead>
                <tr>
                  <td className={sectionCell} colSpan={4}>
                    TEST DETAILS:
                  </td>
                </tr>
                <tr>
                  <th className={cell}>Test</th>
                  <th className={cell}>Acceptance Criteria</th>
                  <th className={cell}>Method / Equipment</th>
                  <th className={cell}>Standard</th>
                </tr>
              </thead>
              <tbody>
                {report.testDetails.map((t) => (
                  <tr key={t.id}>
                    <td className={cell}>{t.testName}</td>
                    <td className={cell}>{t.acceptanceCriteria || "-"}</td>
                    <td className={cell}>{t.methodEquipment || "-"}</td>
                    <td className={cell}>{t.standard || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <table className="mt-2 w-full border-collapse border border-black text-[10px]">
              <thead>
                <tr>
                  <td className={sectionCell} colSpan={6}>
                    Mechanical Properties:
                  </td>
                </tr>
                <tr>
                  <th className={cell}>Property</th>
                  <th className={cell}>Requirement</th>
                  <th className={cell}>Result</th>
                  <th className={cell}>Unit</th>
                  <th className={cell}>Status</th>
                  <th className={cell}>Remarks (OK/NG)</th>
                </tr>
              </thead>
              <tbody>
                {byOrder(report.mechanicalResults, (r) => r.property, MECHANICAL_ORDER).map((r) => {
                  const status = computeNumericStatus(r.result, r.requirementMin, r.requirementMax);
                  return (
                    <tr key={r.id} className={status === "NG" ? "bg-red-200" : undefined}>
                      <td className={cell}>{MECHANICAL_LABEL[r.property] ?? r.property}</td>
                      <td className={cell}>{formatRequirement(r.requirementMin, r.requirementMax, r.requirementText)}</td>
                      <td className={cell}>{r.result ?? "-"}</td>
                      <td className={cell}>{r.unit || "-"}</td>
                      <td className={cell}>{statusCell(status)}</td>
                      <td className={cell}>{r.remark || ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <table className="mt-2 w-full border-collapse border border-black text-[10px]">
              <thead>
                <tr>
                  <td className={sectionCell} colSpan={5}>
                    Chemical Analysis
                  </td>
                </tr>
                <tr>
                  <th className={cell}>Element</th>
                  <th className={cell}>Min Spec (%)</th>
                  <th className={cell}>Max Spec (%)</th>
                  <th className={cell}>Result (%)</th>
                  <th className={cell}>Status</th>
                </tr>
              </thead>
              <tbody>
                {byOrder(report.chemicalResults, (r) => r.element, CHEMICAL_ORDER).map((r) => {
                  const status = computeNumericStatus(r.result, r.requirementMin, r.requirementMax);
                  return (
                    <tr key={r.id} className={status === "NG" ? "bg-red-200" : undefined}>
                      <td className={cell}>{CHEMICAL_LABEL[r.element] ?? r.element}</td>
                      <td className={cell}>{r.requirementMin ?? (r.requirementText || "-")}</td>
                      <td className={cell}>{r.requirementMax ?? "-"}</td>
                      <td className={cell}>{r.result ?? "-"}</td>
                      <td className={cell}>{statusCell(status)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <table className="mt-2 w-full border-collapse border border-black text-[10px]">
              <thead>
                <tr>
                  <td className={sectionCell} colSpan={5}>
                    Paint Details
                  </td>
                </tr>
                <tr>
                  <th className={cell}>Parameter</th>
                  <th className={cell}>Requirement</th>
                  <th className={cell}>Result</th>
                  <th className={cell}>Unit</th>
                  <th className={cell}>Status</th>
                </tr>
              </thead>
              <tbody>
                {byOrder(report.paintResults, (r) => r.property, PAINT_ORDER).map((r) => {
                  const range = parseRangeText(r.requirementText);
                  const status = range && r.resultNumeric != null ? computeNumericStatus(r.resultNumeric, range.min, range.max) : "UNKNOWN";
                  return (
                    <tr key={r.id} className={status === "NG" ? "bg-red-200" : undefined}>
                      <td className={cell}>{PAINT_LABEL[r.property] ?? r.property}</td>
                      <td className={cell}>{r.requirementText || "-"}</td>
                      <td className={cell}>{r.resultText ?? "-"}</td>
                      <td className={cell}>{r.unit || "-"}</td>
                      <td className={cell}>{statusCell(status)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {verificationBlock}
          </div>
        );
      })}
    </div>
  );
}
