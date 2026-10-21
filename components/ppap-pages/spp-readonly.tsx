import Link from "next/link";
import { cn } from "@/lib/utils";
import { PPAP_ELEMENT_NAMES } from "@/lib/constants/ppap-elements";
import type { SppReadOnlyData } from "@/lib/spp";

/**
 * Read-only sections of element 14, each linking to the page its data
 * comes from. Server components, slotted into the client SppForm.
 */

function SourceLinks({ ppapId, elementNos }: { ppapId: string; elementNos: number[] }) {
  return (
    <span className="text-xs text-muted-foreground">
      From{" "}
      {elementNos.map((n, i) => (
        <span key={n}>
          {i > 0 ? ", " : ""}
          <Link href={`/ppap/${ppapId}/${n}`} className="text-primary hover:underline">
            {n}. {PPAP_ELEMENT_NAMES[n]}
          </Link>
        </span>
      ))}
    </span>
  );
}

function SectionHeading({ title, ppapId, sources }: { title: string; ppapId: string; sources?: number[] }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {sources ? <SourceLinks ppapId={ppapId} elementNos={sources} /> : <span className="text-xs text-muted-foreground">From part &amp; PPAP master data</span>}
    </div>
  );
}

function Fields({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(10rem,14rem)_1fr] gap-x-4 gap-y-1 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd>{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function StatusText({ status }: { status: string }) {
  return <span className={cn(status === "NG" && "font-semibold text-red-600 dark:text-red-400", status === "OK" && "text-emerald-700 dark:text-emerald-400")}>{status === "UNKNOWN" ? "—" : status}</span>;
}

/** Section 1. The Date input is the one editable field; it submits with the surrounding SppForm. */
export function SppGeneralSection({
  ppapId,
  data,
  reportDate,
  locked,
}: {
  ppapId: string;
  data: SppReadOnlyData["general"];
  reportDate: Date | null;
  locked: boolean;
}) {
  return (
    <section className="space-y-3 rounded-md border p-3" data-section="1">
      <SectionHeading title="1. General Information" ppapId={ppapId} />
      <Fields
        rows={[
          ["Customer Name", data.customerName],
          ["Supplier Name", data.supplierName],
          ["Part Name", data.partName],
          ["Part Number", data.partNumber],
          ["Drawing Number", data.drawingNumber],
          ["Revision Level", data.revision],
          ["PPAP Level", `Level ${data.level}`],
          ["Submission Reason", data.submissionReason],
        ]}
      />
      <div className="max-w-xs space-y-1">
        <label htmlFor="spp-reportDate" className="text-sm font-medium">
          Date
        </label>
        <input
          id="spp-reportDate"
          name="reportDate"
          type="date"
          defaultValue={reportDate ? reportDate.toISOString().slice(0, 10) : ""}
          disabled={locked}
          className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
        />
      </div>
    </section>
  );
}

export function SppMaterialSection({ ppapId, data }: { ppapId: string; data: SppReadOnlyData["material"] }) {
  return (
    <section className="space-y-3 rounded-md border p-3" data-section="3">
      <SectionHeading title="3. Material Details" ppapId={ppapId} sources={[10, 12]} />
      {data.lots.length > 0 ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="p-1">Raw Material Grade</th>
              <th className="p-1">Material Standard</th>
              <th className="p-1">Heat No / Batch No</th>
              <th className="p-1">Material Test Certificate No</th>
            </tr>
          </thead>
          <tbody>
            {data.lots.map((lot, i) => (
              <tr key={i} className="border-b">
                <td className="p-1">{lot.grade ?? "—"}</td>
                <td className="p-1">{lot.standard ?? "—"}</td>
                <td className="p-1">{lot.heatNo ?? "—"}</td>
                <td className="p-1">{lot.mtcNo ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <Fields
          rows={[
            ["Raw Material Grade", data.fallbackGrade],
            ["Material Standard", data.fallbackStandard],
            ["Heat No / MTC No", "No RM test report lots yet"],
          ]}
        />
      )}
      <Fields
        rows={[
          ["Chemical Composition", data.chemicalSummary],
          ["Mechanical Properties", data.mechanicalSummary],
          ["Lab Report No(s)", data.labReportNos.join(", ")],
        ]}
      />
    </section>
  );
}

export function SppDimensionalSection({ ppapId, data }: { ppapId: string; data: SppReadOnlyData["dimensional"] }) {
  const s = data.summary;
  return (
    <section className="space-y-3 rounded-md border p-3" data-section="4">
      <SectionHeading title="4. Dimensional Inspection Results" ppapId={ppapId} sources={[9, 1]} />
      <p className="text-sm">
        {s.total} dimensions — {s.checked} checked, {s.ok} OK, <span className={cn(s.ng > 0 && "font-semibold text-red-600 dark:text-red-400")}>{s.ng} NG</span> ({s.pctConformance}% conformance)
      </p>
      {data.keyRows.length > 0 ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="p-1">Sr No</th>
              <th className="p-1">Dimension</th>
              <th className="p-1">Spec</th>
              <th className="p-1">Actual</th>
              <th className="p-1">Status (OK/NG)</th>
              <th className="p-1">Measuring Instrument</th>
            </tr>
          </thead>
          <tbody>
            {data.keyRows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="p-1">{r.slNo}</td>
                <td className="p-1">{r.dimension || "—"}</td>
                <td className="p-1">{r.spec || "—"}</td>
                <td className="p-1">{r.actual || "—"}</td>
                <td className="p-1">
                  <StatusText status={r.status} />
                </td>
                <td className="p-1">{r.instrument ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-muted-foreground">No dimensions on the Dimensional Report yet.</p>
      )}
      <p className="text-sm">
        Ballooned drawing:{" "}
        {data.drawing ? (
          <a href={data.drawing.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            {data.drawing.name} (Rev {data.drawing.revision})
          </a>
        ) : (
          <span className="text-muted-foreground">not uploaded on 1. Design Records</span>
        )}
      </p>
    </section>
  );
}

export function SppAppearanceSection({ ppapId, data }: { ppapId: string; data: SppReadOnlyData["appearance"] }) {
  return (
    <section className="space-y-3 rounded-md border p-3" data-section="5">
      <SectionHeading title="5. Appearance Approval (if applicable)" ppapId={ppapId} sources={[13]} />
      {!data.applicable ? (
        <p className="text-sm text-muted-foreground">Not applicable — {data.naReason}</p>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="p-1">Parameter</th>
                <th className="p-1">Requirement</th>
                <th className="p-1">Result</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={i} className="border-b">
                  <td className="p-1">{r.parameter}</td>
                  <td className="p-1">{r.requirement ?? "—"}</td>
                  <td className="p-1">{r.result ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Fields
            rows={[
              ["AAR Overall Result", data.overallResult],
              ["Customer Approval", data.customerStatus],
            ]}
          />
        </>
      )}
    </section>
  );
}

export function SppProcessSection({ ppapId, data }: { ppapId: string; data: SppReadOnlyData["process"] }) {
  return (
    <section className="space-y-3 rounded-md border p-3" data-section="7">
      <SectionHeading title="7. Process Details" ppapId={ppapId} sources={[5, 6, 7]} />
      <Fields
        rows={[
          ["Manufacturing Process", data.manufacturingProcess],
          ["Special Processes", data.specialProcesses.length ? data.specialProcesses.join(", ") : "None identified"],
          ["Control Plan Available", data.controlPlan],
          ["Process Flow Diagram", data.processFlow],
          ["PFMEA Status", data.pfmea],
        ]}
      />
    </section>
  );
}

export function SppMsaSection({ ppapId, data }: { ppapId: string; data: SppReadOnlyData["msa"] }) {
  return (
    <section className="space-y-3 rounded-md border p-3" data-section="8">
      <SectionHeading title="8. Measurement System Analysis (MSA)" ppapId={ppapId} sources={[8, 16]} />
      {data.length > 0 ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="p-1">Instrument</th>
              <th className="p-1">Type</th>
              <th className="p-1">Calibration Status</th>
              <th className="p-1">GRR Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="p-1">{r.instrument}</td>
                <td className="p-1">{r.type ?? "—"}</td>
                <td className={cn("p-1", (r.calibrationStatus === "OVERDUE" || r.calibrationStatus === "NOT_CALIBRATED") && "text-red-600 dark:text-red-400", r.calibrationStatus === "DUE_SOON" && "text-amber-700 dark:text-amber-400")}>
                  {r.calibration}
                </td>
                <td className="p-1">{r.grr}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-muted-foreground">No instruments referenced by the Control Plan, Dimensional Report or MSA yet.</p>
      )}
    </section>
  );
}
