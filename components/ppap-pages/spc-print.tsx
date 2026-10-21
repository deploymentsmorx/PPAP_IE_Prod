import { prisma } from "@/lib/prisma";
import { formatDateIndia } from "@/lib/format";
import { getSpcStudyResults } from "@/lib/actions/spc";
import { PrintHeader } from "@/components/print-header";
import { PrintFooter } from "@/components/print-footer";

const VERDICT_LABEL: Record<string, string> = {
  ACCEPTABLE: "Acceptable",
  CONDITIONAL: "Conditional",
  NOT_ACCEPTABLE: "Not acceptable",
};

export async function SpcPrint({ ppapId }: { ppapId: string }) {
  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { ppapId_elementNo: { ppapId, elementNo: 11 } },
    include: {
      preparedBy: true,
      approvedBy: true,
      ppap: { include: { customer: true, partRevision: { include: { part: true } } } },
      spcStudies: {
        orderBy: { sortOrder: "asc" },
        include: { readings: true, specialCharacteristic: true, instrument: true },
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
  const studies = element.spcStudies;
  const results = await Promise.all(studies.map((s) => getSpcStudyResults(s.id)));

  const footerEntries = [
    { label: "Prepared By", name: element.preparedBy?.name ?? null, date: element.preparedAt },
    { label: "Approved By", name: element.approvedBy?.name ?? null, date: element.approvedAt },
  ];

  return (
    <div className="bg-white text-black">
      <style>{`
        @page { size: A4 landscape; margin: 10mm; }
        @media print {
          .spc-print-page { page-break-after: always; }
          .spc-print-page:last-child { page-break-after: auto; }
        }
      `}</style>

      {studies.length === 0 ? (
        <div className="p-4">
          <PrintHeader
            supplierName="Smorx"
            title="STATISTICAL PROCESS CONTROL STUDY"
            subtitle={`${element.ppap.customer.name} — ${part.partName} (${part.partNumber})`}
            docNo={element.docNo}
            revision={element.revision}
          />
          <p className="mt-3 text-sm">No SPC studies recorded.</p>
        </div>
      ) : null}

      {studies.map((study, i) => {
        const r = results[i];
        return (
          <div key={study.id} className="spc-print-page p-4">
            <PrintHeader
              supplierName="Smorx"
              title="STATISTICAL PROCESS CONTROL STUDY"
              subtitle={`${element.ppap.customer.name} — ${part.partName} (${part.partNumber})`}
              docNo={element.docNo}
              revision={element.revision}
            />

            <table className="mt-2 w-full border-collapse border border-black text-[10px]">
              <tbody>
                <tr>
                  <td className="border border-black p-1 font-medium">Characteristic</td>
                  <td className="border border-black p-1">{study.specialCharacteristic?.characteristic || "-"}</td>
                  <td className="border border-black p-1 font-medium">Spec</td>
                  <td className="border border-black p-1">
                    {study.specText || "-"} (USL {study.usl ?? "-"} / LSL {study.lsl ?? "-"})
                  </td>
                  <td className="border border-black p-1 font-medium">Date</td>
                  <td className="border border-black p-1">{study.studyDate ? formatDateIndia(study.studyDate) : "-"}</td>
                </tr>
                <tr>
                  <td className="border border-black p-1 font-medium">Instrument</td>
                  <td className="border border-black p-1">{study.instrument?.description || "-"}</td>
                  <td className="border border-black p-1 font-medium">Least Count</td>
                  <td className="border border-black p-1">{study.leastCountText || study.instrument?.leastCount || "-"}</td>
                  <td className="border border-black p-1 font-medium">Machine</td>
                  <td className="border border-black p-1">{study.machine || "-"}</td>
                </tr>
                <tr>
                  <td className="border border-black p-1 font-medium">Operation</td>
                  <td className="border border-black p-1">{study.operation || "-"}</td>
                  <td className="border border-black p-1 font-medium">DC No.</td>
                  <td className="border border-black p-1">{study.dcNo || "-"}</td>
                  <td className="border border-black p-1 font-medium">Qty</td>
                  <td className="border border-black p-1">{study.qty ?? "-"}</td>
                </tr>
              </tbody>
            </table>

            <table className="mt-2 w-full border-collapse border border-black text-[10px]">
              <thead>
                <tr>
                  <th className="border border-black p-1">Subgroup</th>
                  {Array.from({ length: study.subgroupSize }, (_, w) => (
                    <th key={w} className="border border-black p-1">
                      Reading {w + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: study.subgroupCount }, (_, s) => (
                  <tr key={s}>
                    <td className="border border-black p-1 font-medium">{s + 1}</td>
                    {Array.from({ length: study.subgroupSize }, (_, w) => {
                      const reading = study.readings.find((rd) => rd.subgroupIndex === s && rd.withinIndex === w);
                      return (
                        <td key={w} className="border border-black p-1">
                          {reading?.value != null ? reading.value.toFixed(study.decimals) : "-"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {!r.complete ? (
              <p className="mt-3 text-xs">
                Data grid incomplete ({r.filled} of {r.expected} readings) or USL/LSL not set — results not yet computable.
              </p>
            ) : (
              <table className="mt-2 w-full border-collapse border border-black text-[10px]">
                <thead>
                  <tr>
                    <th className="border border-black p-1"></th>
                    <th className="border border-black p-1">Cp / Pp</th>
                    <th className="border border-black p-1">Cpk / Ppk</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-black p-1 font-medium">Standard (σ within = R̄/d2)</td>
                    <td className="border border-black p-1">{r.cp.toFixed(3)}</td>
                    <td className="border border-black p-1">{r.cpk.toFixed(3)}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1 font-medium">Overall (σ overall = STDEV)</td>
                    <td className="border border-black p-1">{r.pp.toFixed(3)}</td>
                    <td className="border border-black p-1">{r.ppk.toFixed(3)}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1 font-medium">Client method (K={r.clientK.toFixed(4)})</td>
                    <td className="border border-black p-1">{r.clientCp.toFixed(3)}</td>
                    <td className="border border-black p-1">{r.clientCpk.toFixed(3)}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1 font-medium">X̄̄ / R̄</td>
                    <td className="border border-black p-1" colSpan={2}>
                      {r.xBarBar.toFixed(3)} / {r.rBar.toFixed(3)} (UCL X̄ {r.xBarUcl.toFixed(3)}, LCL X̄ {r.xBarLcl.toFixed(3)}, UCL R{" "}
                      {r.rUcl.toFixed(3)})
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1 font-medium">Out of spec</td>
                    <td className="border border-black p-1" colSpan={2}>
                      {r.aboveUsl} above USL, {r.belowLsl} below LSL
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1 font-medium">Verdict</td>
                    <td className="border border-black p-1" colSpan={2}>
                      {VERDICT_LABEL[r.verdict]} — {r.remark}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}

            <PrintFooter entries={footerEntries} />
          </div>
        );
      })}
    </div>
  );
}
