import { prisma } from "@/lib/prisma";
import { formatDateIndia } from "@/lib/format";
import { getStudyResults } from "@/lib/actions/msa";
import { PrintHeader } from "@/components/print-header";
import { PrintFooter } from "@/components/print-footer";

const STUDY_TYPE_LABEL: Record<string, string> = {
  VARIABLE_GRR: "Variable GR&R",
  ATTRIBUTE_AGREEMENT: "Attribute Agreement",
  BIAS: "Bias",
  LINEARITY: "Linearity",
  STABILITY: "Stability",
};

const VERDICT_LABEL: Record<string, string> = {
  ACCEPTABLE: "Acceptable",
  CONDITIONALLY_ACCEPTABLE: "Conditionally acceptable",
  NOT_ACCEPTABLE: "Not acceptable",
};

export async function MsaPrint({ ppapId }: { ppapId: string }) {
  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { ppapId_elementNo: { ppapId, elementNo: 8 } },
    include: {
      preparedBy: true,
      approvedBy: true,
      ppap: { include: { customer: true, partRevision: { include: { part: true } } } },
      msaStudies: {
        orderBy: { sortOrder: "asc" },
        include: { gauge: true, controlPlanRow: true },
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

  const part = element.ppap.partRevision.part;
  const studies = element.msaStudies;
  const results = await Promise.all(studies.map((s) => getStudyResults(s.id)));

  const footerEntries = [
    { label: "Prepared By", name: element.preparedBy?.name ?? null, date: element.preparedAt },
    { label: "Approved By", name: element.approvedBy?.name ?? null, date: element.approvedAt },
  ];

  return (
    <div className="bg-white text-black">
      <style>{`
        @page { size: A4 landscape; margin: 10mm; }
        @media print {
          .msa-print-page { page-break-after: always; }
          .msa-print-page:last-child { page-break-after: auto; }
        }
      `}</style>

      {studies.map((study, i) => {
        const r = results[i];
        const characteristic = study.controlPlanRow?.productCharacteristic || study.controlPlanRow?.processCharacteristic || study.characteristicText;
        return (
          <div key={study.id} className="msa-print-page p-4">
            <PrintHeader
              supplierName="Smorx"
              title="MEASUREMENT SYSTEM ANALYSIS (MSA)"
              subtitle={`${element.ppap.customer.name} — ${part.partName} (${part.partNumber})`}
              docNo={element.docNo}
              revision={element.revision}
            />

            <table className="mt-2 w-full border-collapse border border-black text-[10px]">
              <tbody>
                <tr>
                  <td className="border border-black p-1 font-medium">Study Type</td>
                  <td className="border border-black p-1">{STUDY_TYPE_LABEL[study.studyType] ?? study.studyType}</td>
                  <td className="border border-black p-1 font-medium">Date</td>
                  <td className="border border-black p-1">{study.studyDate ? formatDateIndia(study.studyDate) : "-"}</td>
                  <td className="border border-black p-1 font-medium">Units</td>
                  <td className="border border-black p-1">{study.units || "-"}</td>
                </tr>
                <tr>
                  <td className="border border-black p-1 font-medium">Characteristic</td>
                  <td className="border border-black p-1">{characteristic || "-"}</td>
                  <td className="border border-black p-1 font-medium">Specification</td>
                  <td className="border border-black p-1">{study.specification || "-"}</td>
                  <td className="border border-black p-1 font-medium">Test No.</td>
                  <td className="border border-black p-1">{study.testNo || "-"}</td>
                </tr>
                <tr>
                  <td className="border border-black p-1 font-medium">Gauge</td>
                  <td className="border border-black p-1">{study.gauge?.description || "-"}</td>
                  <td className="border border-black p-1 font-medium">Gauge Type</td>
                  <td className="border border-black p-1">{study.gaugeType || "-"}</td>
                  <td className="border border-black p-1 font-medium">USL / LSL</td>
                  <td className="border border-black p-1">
                    {study.usl ?? "-"} / {study.lsl ?? "-"}
                  </td>
                </tr>
                <tr>
                  <td className="border border-black p-1 font-medium">Appraisers</td>
                  <td className="border border-black p-1" colSpan={3}>
                    {[study.appraiserAName, study.appraiserBName, study.appraiserCName].filter(Boolean).join(", ") || "-"}
                  </td>
                  <td className="border border-black p-1 font-medium">p × o × n</td>
                  <td className="border border-black p-1">
                    {study.parts} × {study.appraisers} × {study.trials}
                  </td>
                </tr>
              </tbody>
            </table>

            {study.studyType !== "VARIABLE_GRR" ? (
              <p className="mt-3 text-xs">
                {STUDY_TYPE_LABEL[study.studyType]} study — not yet computed. Notes: {study.notes || "-"}
              </p>
            ) : !r.complete || !r.result ? (
              <p className="mt-3 text-xs">
                Data grid incomplete ({r.filled} of {r.expected} readings) — results not yet computable.
              </p>
            ) : (
              (() => {
                const result = r.result;
                return (
                  <table className="mt-2 w-full border-collapse border border-black text-[10px]">
                    <thead>
                      <tr className="bg-muted/40">
                        <th className="border border-black p-1"></th>
                        <th className="border border-black p-1">Value</th>
                        <th className="border border-black p-1">% of TV</th>
                        {result.tolerance != null ? <th className="border border-black p-1">% of Tolerance</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["EV (Repeatability)", result.ev, result.pctEvOfTv, result.pctEvOfTolerance],
                        ["AV (Reproducibility)", result.av, result.pctAvOfTv, result.pctAvOfTolerance],
                        ["GRR", result.grr, result.pctGrrOfTv, result.pctGrrOfTolerance],
                        ["PV (Part Variation)", result.pv, result.pctPvOfTv, result.pctPvOfTolerance],
                        ["TV (Total Variation)", result.tv, 100, result.tolerance != null ? (100 * result.tv) / result.tolerance : null],
                      ].map(([label, value, pctTv, pctTol]) => (
                        <tr key={label as string}>
                          <td className="border border-black p-1 font-medium">{label}</td>
                          <td className="border border-black p-1">{(value as number).toFixed(3)}</td>
                          <td className="border border-black p-1">{(pctTv as number).toFixed(1)}%</td>
                          {result.tolerance != null ? (
                            <td className="border border-black p-1">{pctTol != null ? `${(pctTol as number).toFixed(1)}%` : "-"}</td>
                          ) : null}
                        </tr>
                      ))}
                      <tr>
                        <td className="border border-black p-1 font-medium">ndc</td>
                        <td className="border border-black p-1" colSpan={result.tolerance != null ? 3 : 2}>
                          {result.ndc} {result.ndc >= 5 ? "(OK, >= 5)" : "(< 5)"}
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-black p-1 font-medium">Verdict</td>
                        <td className="border border-black p-1" colSpan={result.tolerance != null ? 3 : 2}>
                          {VERDICT_LABEL[result.verdict]}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                );
              })()
            )}

            <PrintFooter entries={footerEntries} />
            <table className="mt-1 w-full border-collapse border border-black text-[9px]">
              <tbody>
                <tr>
                  <td className="border border-black p-1">Doc No: {element.docNo}</td>
                  <td className="border border-black p-1">
                    Study {i + 1} of {studies.length}
                  </td>
                  <td className="border border-black p-1">Date: {formatDateIndia(new Date())}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}

      {studies.length === 0 ? <div className="p-4 text-center text-sm text-muted-foreground">No MSA studies recorded.</div> : null}
    </div>
  );
}
