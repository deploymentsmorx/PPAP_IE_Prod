import { prisma } from "@/lib/prisma";
import { formatDateIndia } from "@/lib/format";
import { PrintHeader } from "@/components/print-header";
import { PrintFooter } from "@/components/print-footer";

const ROWS_PER_PAGE_TARGET = 30;

function checkbox(checked: boolean | undefined, label: string) {
  return (
    <span>
      {label} {checked ? "[✓]" : "[ ]"}
    </span>
  );
}

export async function ControlPlanPrint({ ppapId }: { ppapId: string }) {
  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { ppapId_elementNo: { ppapId, elementNo: 7 } },
    include: {
      preparedBy: true,
      checkedBy: true,
      approvedBy: true,
      ppap: { include: { customer: true, partRevision: { include: { part: true } } } },
      controlPlanDetail: {
        include: { rows: { orderBy: { sortOrder: "asc" }, include: { instrument: true, specialCharacteristic: true } } },
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

  const detail = element.controlPlanDetail;
  const rows = detail?.rows ?? [];
  const part = element.ppap.partRevision.part;

  const pages: (typeof rows)[] = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_PAGE_TARGET) {
    pages.push(rows.slice(i, i + ROWS_PER_PAGE_TARGET));
  }
  if (pages.length === 0) pages.push([]);

  const footerEntries = [
    { label: "Prepared By", name: element.preparedBy?.name ?? null, date: element.preparedAt },
    { label: "Checked By", name: element.checkedBy?.name ?? null, date: element.checkedAt },
    { label: "Approved By", name: element.approvedBy?.name ?? null, date: element.approvedAt },
  ];

  return (
    <div className="bg-white text-black">
      <style>{`
        @page { size: A3 landscape; margin: 8mm; }
        @media print {
          .cp-print-page { page-break-after: always; }
          .cp-print-page:last-child { page-break-after: auto; }
        }
      `}</style>

      {pages.map((pageRows, pageIndex) => (
        <div key={pageIndex} className="cp-print-page p-4">
          <PrintHeader
            supplierName="Smorx"
            title="CONTROL PLAN"
            subtitle={`${element.ppap.customer.name} — ${part.partName} (${part.partNumber})`}
            docNo={detail?.controlPlanNo}
            revision={detail?.revisionNo ?? undefined}
            issueDate={detail?.dateOrig ? formatDateIndia(detail.dateOrig) : undefined}
            revisionDate={detail?.dateRev ? formatDateIndia(detail.dateRev) : undefined}
          />

          <table className="mt-2 w-full border-collapse border border-black text-[9px]">
            <tbody>
              <tr>
                <td className="border border-black p-1" colSpan={3}>
                  {checkbox(detail?.phasePrototype, "PROTOTYPE")} &nbsp; {checkbox(detail?.phasePreLaunch, "PRE-LAUNCH")} &nbsp;{" "}
                  {checkbox(detail?.phaseProduction, "PRODUCTION")}
                </td>
                <td className="border border-black p-1 font-medium">Part Description</td>
                <td className="border border-black p-1" colSpan={2}>
                  {detail?.partDescription || "-"}
                </td>
              </tr>
              <tr>
                <td className="border border-black p-1 font-medium">Customer Part No. / Rev.</td>
                <td className="border border-black p-1">
                  {detail?.customerPartNo || "-"} / {detail?.customerPartRevision || "-"}
                </td>
                <td className="border border-black p-1 font-medium">Part No. / Rev.</td>
                <td className="border border-black p-1">
                  {detail?.partNo || "-"} / {detail?.partRevision || "-"}
                </td>
                <td className="border border-black p-1 font-medium">Supplier / Plant</td>
                <td className="border border-black p-1">
                  {detail?.supplier || "-"} / {detail?.plant || "-"}
                </td>
              </tr>
              <tr>
                <td className="border border-black p-1 font-medium">Material</td>
                <td className="border border-black p-1">{detail?.material || "-"}</td>
                <td className="border border-black p-1 font-medium">Key Contact / Phone</td>
                <td className="border border-black p-1" colSpan={3}>
                  {detail?.keyContactPhone || "-"}
                </td>
              </tr>
              <tr>
                <td className="border border-black p-1 font-medium">Core Team</td>
                <td className="border border-black p-1" colSpan={5}>
                  {detail?.coreTeamText || "-"}
                </td>
              </tr>
              <tr>
                <td className="border border-black p-1 font-medium">Supplier Plant Approval / Date</td>
                <td className="border border-black p-1">
                  {detail?.supplierPlantApprovalDate ? formatDateIndia(detail.supplierPlantApprovalDate) : "-"}
                </td>
                <td className="border border-black p-1 font-medium">Cust. Engg. Approval / Date</td>
                <td className="border border-black p-1">
                  {detail?.customerEngineeringApprovalDate ? formatDateIndia(detail.customerEngineeringApprovalDate) : "-"}
                </td>
                <td className="border border-black p-1 font-medium">Cust. Quality Approval / Date</td>
                <td className="border border-black p-1">
                  {detail?.customerQualityApprovalDate ? formatDateIndia(detail.customerQualityApprovalDate) : "-"}
                </td>
              </tr>
            </tbody>
          </table>

          <table className="mt-2 w-full border-collapse border border-black text-[7px]">
            <thead>
              <tr className="bg-muted/40">
                {[
                  "Process Name / Operation Description",
                  "Machine/Device/Jig/Tools for Mfg.",
                  "Stage No.",
                  "Characteristics — Product",
                  "Characteristics — Process",
                  "Spl. Char. Class",
                  "Product/Process Specification, Standard",
                  "Evaluation/Measurement Technique",
                  "Inst. No.",
                  "Least Count",
                  "Control Incharge",
                  "Sample Size",
                  "Sample Freq.",
                  "Recording (Yes/No)",
                  "Control Method",
                  "Reaction Plan",
                ].map((h) => (
                  <th key={h} className="border border-black p-1">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr key={row.id}>
                  <td className="border border-black p-1">{row.processNameOperation || "-"}</td>
                  <td className="border border-black p-1">{row.machineDeviceJigTools || "-"}</td>
                  <td className="border border-black p-1 text-center">{row.stageNo ?? "-"}</td>
                  <td className="border border-black p-1">{row.productCharacteristic || "-"}</td>
                  <td className="border border-black p-1">{row.processCharacteristic || "-"}</td>
                  <td className="border border-black p-1 text-center">
                    {row.specialCharacteristic ? row.specialCharacteristic.symbol ?? row.specialCharacteristic.charClass : "-"}
                  </td>
                  <td className="border border-black p-1">{row.productProcessSpecification || "-"}</td>
                  <td className="border border-black p-1">{row.evaluationMeasurementTechnique || "-"}</td>
                  <td className="border border-black p-1">{row.instrument?.description ?? "-"}</td>
                  <td className="border border-black p-1 text-center">{row.leastCountText || "-"}</td>
                  <td className="border border-black p-1 text-center">{row.controlInCharge || "-"}</td>
                  <td className="border border-black p-1 text-center">{row.sampleSize || "-"}</td>
                  <td className="border border-black p-1 text-center">{row.sampleFrequency || "-"}</td>
                  <td className="border border-black p-1 text-center">
                    {row.recordingRequired === null ? "-" : row.recordingRequired ? "Yes" : "No"}
                  </td>
                  <td className="border border-black p-1">{row.controlMethod || "-"}</td>
                  <td className="border border-black p-1 text-center">{row.reactionPlan || "-"}</td>
                </tr>
              ))}
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={16} className="border border-black p-2 text-center">
                    No Control Plan rows recorded.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <table className="mt-2 w-full border-collapse border border-black text-[7px]">
            <thead>
              <tr>
                <th className="border border-black p-1" colSpan={1}>
                  Legends for Control Incharge
                </th>
                <th className="border border-black p-1" colSpan={1}>
                  Legend for Char. Classification
                </th>
                <th className="border border-black p-1" colSpan={1}>
                  Legend for Reaction Plan
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black p-1 align-top">
                  <div>W - Regular Operator Check</div>
                  <div>P - Process Approval by QA</div>
                  <div>I - Patrol Inspection</div>
                  <div>Q - Lot Approval by QA</div>
                </td>
                <td className="border border-black p-1 align-top">
                  <div>Customer — Critical / Major</div>
                  <div>Supplier — Critical / Major</div>
                </td>
                <td className="border border-black p-1 align-top">
                  <div>A - Adjust and recheck.</div>
                  <div>B - Replace / reprofile the tools and reverify since last check.</div>
                  <div>C - Put NC tag and inform shift incharge and reverify since last check.</div>
                  <div>D - Quarantine the material.</div>
                </td>
              </tr>
            </tbody>
          </table>

          <PrintFooter entries={footerEntries} />
          <table className="mt-1 w-full border-collapse border border-black text-[9px]">
            <tbody>
              <tr>
                <td className="border border-black p-1">Control Plan No.: {detail?.controlPlanNo ?? "-"}</td>
                <td className="border border-black p-1">
                  Page {pageIndex + 1} of {pages.length}
                </td>
                <td className="border border-black p-1">Date: {formatDateIndia(new Date())}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
