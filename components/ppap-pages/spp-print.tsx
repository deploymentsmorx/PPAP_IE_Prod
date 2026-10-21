import { prisma } from "@/lib/prisma";
import { formatDateIndia } from "@/lib/format";
import { getSppReadOnlyData } from "@/lib/spp";
import { SPP_DECLARATION_TEXT } from "@/lib/calc/spp";
import { PrintHeader } from "@/components/print-header";

const cell = "border border-black p-1 align-top";
const labelCell = `${cell} w-1/3 font-medium`;
const sectionCell = "border border-black bg-gray-100 p-1 font-semibold";

const DISPOSITION_LABEL: Record<string, string> = { APPROVED: "Approved", REJECTED: "Rejected", CONDITIONAL: "Conditional" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <table className="mt-2 w-full break-inside-avoid border-collapse border border-black text-[10px]">
      <tbody>
        <tr>
          <td className={sectionCell} colSpan={6}>
            {title}
          </td>
        </tr>
        {children}
      </tbody>
    </table>
  );
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <td className={labelCell}>{label}</td>
      <td className={cell} colSpan={5}>
        {value || "-"}
      </td>
    </tr>
  );
}

/** Mirrors the reference sheet "14. Sample Production Part" (portrait), sections 1-11. */
export async function SppPrint({ ppapId }: { ppapId: string }) {
  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { ppapId_elementNo: { ppapId, elementNo: 14 } },
    include: {
      sppDetail: { include: { declaredBy: true } },
      sppSamples: { orderBy: { sortOrder: "asc" } },
      sppFunctionalTests: { orderBy: { sortOrder: "asc" } },
      sppPackagingPhotos: { orderBy: { uploadedAt: "asc" } },
      customerDisposition: true,
    },
  });
  const header = (
    <PrintHeader supplierName="Ingenious Engineering" title="PPAP DOCUMENTS" subtitle="SAMPLE PRODUCTION PART" docNo={element.docNo} revision={element.revision} />
  );

  if (element.applicability === "NA") {
    return (
      <div className="mx-auto max-w-4xl bg-white p-6 text-black print:p-0">
        {header}
        <p className="mt-4 text-sm">N/A — {element.naReason}</p>
      </div>
    );
  }

  const data = await getSppReadOnlyData(ppapId);
  const d = element.sppDetail;
  const cd = element.customerDisposition;
  const samples = element.sppSamples;
  const lots = data.material.lots;

  return (
    <div className="mx-auto max-w-4xl bg-white p-6 text-black print:p-0">
      <style>{`@page { size: A4 portrait; margin: 10mm; }`}</style>
      {header}
      <div className="mt-2 border border-black p-1 text-center text-sm font-semibold">PRODUCTION PART SAMPLE FORMAT</div>

      <Section title="1. General Information">
        <FieldRow label="Customer Name" value={data.general.customerName} />
        <FieldRow label="Supplier Name" value={data.general.supplierName} />
        <FieldRow label="Part Name" value={data.general.partName} />
        <FieldRow label="Part Number" value={data.general.partNumber} />
        <FieldRow label="Drawing Number" value={data.general.drawingNumber} />
        <FieldRow label="Revision Level" value={data.general.revision} />
        <FieldRow label="Date" value={d?.reportDate ? formatDateIndia(d.reportDate) : null} />
        <FieldRow label="PPAP Level" value={`Level ${data.general.level}`} />
        <FieldRow label="Submission Reason" value={data.general.submissionReason} />
      </Section>

      <Section title="2. Sample Part Details">
        <FieldRow label="Sample Quantity Submitted" value={samples.length ? `${samples.length} Nos (${samples.map((s) => s.sampleId).join(", ")})` : null} />
        <FieldRow label="Lot / Batch No" value={[...new Set(samples.map((s) => s.lotBatchNo).filter(Boolean))].join(", ")} />
        <FieldRow
          label="Manufacturing Date"
          value={[...new Set(samples.map((s) => (s.manufacturingDate ? formatDateIndia(s.manufacturingDate) : null)).filter(Boolean))].join(", ")}
        />
        <FieldRow label="Shift" value={[...new Set(samples.map((s) => s.shift).filter(Boolean))].join(", ")} />
        <FieldRow label="Machine No" value={[...new Set(samples.map((s) => s.machineNo).filter(Boolean))].join(", ")} />
        <FieldRow label="Cavity No (if applicable)" value={[...new Set(samples.map((s) => s.cavityNo).filter(Boolean))].join(", ")} />
      </Section>

      <Section title="3. Material Details">
        <FieldRow label="Raw Material Grade" value={[...new Set(lots.map((l) => l.grade).filter(Boolean))].join(", ") || data.material.fallbackGrade} />
        <FieldRow label="Material Standard" value={[...new Set(lots.map((l) => l.standard).filter(Boolean))].join(", ") || data.material.fallbackStandard} />
        <FieldRow label="Heat No / Batch No" value={lots.map((l) => l.heatNo).filter(Boolean).join(", ")} />
        <FieldRow label="Material Test Certificate No" value={lots.map((l) => l.mtcNo).filter(Boolean).join(", ")} />
        <FieldRow label="Chemical Composition" value={data.material.chemicalSummary} />
        <FieldRow label="Mechanical Properties" value={data.material.mechanicalSummary} />
      </Section>

      <Section title="4. Dimensional Inspection Results">
        <tr>
          <td className={cell} colSpan={6}>
            {data.dimensional.summary.total} dimensions — {data.dimensional.summary.checked} checked, {data.dimensional.summary.ok} OK, {data.dimensional.summary.ng} NG (
            {data.dimensional.summary.pctConformance}% conformance). Full report: 9. Dimensional Results.
          </td>
        </tr>
        <tr>
          <th className={cell}>Sr No</th>
          <th className={cell}>Dimension</th>
          <th className={cell}>Spec</th>
          <th className={cell}>Actual</th>
          <th className={cell}>Status (OK/NG)</th>
          <th className={cell}>Measuring Instrument</th>
        </tr>
        {data.dimensional.keyRows.map((r) => (
          <tr key={r.id} className={r.status === "NG" ? "bg-red-200" : undefined}>
            <td className={cell}>{r.slNo}</td>
            <td className={cell}>{r.dimension || "-"}</td>
            <td className={cell}>{r.spec || "-"}</td>
            <td className={cell}>{r.actual || "-"}</td>
            <td className={cell}>{r.status === "UNKNOWN" ? "-" : r.status}</td>
            <td className={cell}>{r.instrument ?? "-"}</td>
          </tr>
        ))}
        <tr>
          <td className={cell} colSpan={6}>
            Ballooned drawing: {data.dimensional.drawing ? `${data.dimensional.drawing.name} (Rev ${data.dimensional.drawing.revision}) — see 1. Design Records` : "not uploaded"}
          </td>
        </tr>
      </Section>

      <Section title="5. Appearance Approval (if applicable)">
        {!data.appearance.applicable ? (
          <tr>
            <td className={cell} colSpan={6}>
              Not applicable — {data.appearance.naReason}
            </td>
          </tr>
        ) : (
          <>
            <tr>
              <th className={cell} colSpan={2}>
                Parameter
              </th>
              <th className={cell} colSpan={2}>
                Requirement
              </th>
              <th className={cell} colSpan={2}>
                Result
              </th>
            </tr>
            {data.appearance.rows.map((r, i) => (
              <tr key={i}>
                <td className={cell} colSpan={2}>
                  {r.parameter}
                </td>
                <td className={cell} colSpan={2}>
                  {r.requirement ?? "-"}
                </td>
                <td className={cell} colSpan={2}>
                  {r.result ?? "-"}
                </td>
              </tr>
            ))}
            <FieldRow label="Status (AAR overall / customer)" value={[data.appearance.overallResult, data.appearance.customerStatus].filter(Boolean).join(" / ")} />
          </>
        )}
      </Section>

      <Section title="6. Functional / Performance Test">
        <tr>
          <th className={cell} colSpan={2}>
            Test Name
          </th>
          <th className={cell} colSpan={2}>
            Specification
          </th>
          <th className={cell}>Result</th>
          <th className={cell}>Status</th>
        </tr>
        {element.sppFunctionalTests.length === 0 ? (
          <tr>
            <td className={cell} colSpan={6}>
              -
            </td>
          </tr>
        ) : (
          element.sppFunctionalTests.map((t) => (
            <tr key={t.id} className={t.status === "NG" ? "bg-red-200" : undefined}>
              <td className={cell} colSpan={2}>
                {t.testName}
              </td>
              <td className={cell} colSpan={2}>
                {t.specification ?? "-"}
              </td>
              <td className={cell}>{t.result ?? "-"}</td>
              <td className={cell}>{t.status ?? "-"}</td>
            </tr>
          ))
        )}
      </Section>

      <Section title="7. Process Details">
        <FieldRow label="Manufacturing Process" value={data.process.manufacturingProcess} />
        <FieldRow label="Special Processes" value={data.process.specialProcesses.join(", ") || "None identified"} />
        <FieldRow label="Control Plan Available" value={data.process.controlPlan} />
        <FieldRow label="Process Flow Diagram" value={data.process.processFlow} />
        <FieldRow label="PFMEA Status" value={data.process.pfmea} />
      </Section>

      <Section title="8. Measurement System Analysis (MSA)">
        <tr>
          <th className={cell} colSpan={2}>
            Instrument
          </th>
          <th className={cell}>Type</th>
          <th className={cell} colSpan={2}>
            Calibration Status
          </th>
          <th className={cell}>GRR Status</th>
        </tr>
        {data.msa.map((r) => (
          <tr key={r.id}>
            <td className={cell} colSpan={2}>
              {r.instrument}
            </td>
            <td className={cell}>{r.type ?? "-"}</td>
            <td className={cell} colSpan={2}>
              {r.calibration}
            </td>
            <td className={cell}>{r.grr}</td>
          </tr>
        ))}
      </Section>

      <Section title="9. Packaging Details">
        <FieldRow label="Packing Method" value={d?.packingMethod} />
        <FieldRow label="Labeling" value={d?.labelling} />
        <FieldRow label="Protection Method" value={d?.protectionMethod} />
        {element.sppPackagingPhotos.length > 0 ? (
          <tr>
            <td className={cell} colSpan={6}>
              <div className="flex flex-wrap gap-2">
                {element.sppPackagingPhotos.map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={p.id} src={p.fileUrl} alt="Packaging photo" className="h-24 w-32 border border-black object-cover" />
                ))}
              </div>
            </td>
          </tr>
        ) : null}
      </Section>

      <Section title="10. Declaration">
        <tr>
          <td className={cell} colSpan={6}>
            {SPP_DECLARATION_TEXT}
          </td>
        </tr>
        <tr>
          <td className={cell} colSpan={6}>
            <span className="font-medium">Authorized Signatory</span>
          </td>
        </tr>
        <tr>
          <th className={cell}>Name</th>
          <th className={cell}>Designation</th>
          <th className={cell} colSpan={2}>
            Signature
          </th>
          <th className={cell} colSpan={2}>
            Date
          </th>
        </tr>
        <tr>
          <td className={cell}>{d?.declaredBy?.name ?? ""}</td>
          <td className={cell}>{d?.declaredBy?.designation ?? ""}</td>
          <td className={`${cell} h-8`} colSpan={2} />
          <td className={cell} colSpan={2}>
            {d?.declaredAt ? formatDateIndia(d.declaredAt) : ""}
          </td>
        </tr>
      </Section>

      <Section title="11. Customer Approval">
        <FieldRow label="Status" value={cd?.status ? DISPOSITION_LABEL[cd.status] : "Approved / Rejected / Conditional"} />
        <FieldRow label="Customer Name" value={[cd?.customerName, cd?.customerDesignation].filter(Boolean).join(", ")} />
        <tr>
          <td className={labelCell}>Signature</td>
          <td className={`${cell} h-8`} colSpan={5} />
        </tr>
        <FieldRow label="Date" value={cd?.customerSignatureDate ? formatDateIndia(cd.customerSignatureDate) : null} />
        {cd?.comments ? <FieldRow label="Comments" value={cd.comments} /> : null}
      </Section>
    </div>
  );
}
