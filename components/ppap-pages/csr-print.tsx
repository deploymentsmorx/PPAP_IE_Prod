import { prisma } from "@/lib/prisma";
import { getCsrComplianceView } from "@/lib/csr";
import { cropLayout, parseAnnotations, parseCrop, complianceSummary } from "@/lib/calc/csr";
import { PPAP_ELEMENT_NAMES } from "@/lib/constants/ppap-elements";
import { PrintHeader } from "@/components/print-header";
import { PrintFooter } from "@/components/print-footer";
import { ZonePicture } from "@/components/csr/zone-picture";

const cell = "border border-black p-1 align-top";
/** Usable picture height on an A4 portrait page under the header (mm). */
const PAGE_PICTURE_HEIGHT_MM = 235;
const PAGE_WIDTH_MM = 180;

/**
 * Mirrors the reference sheet "17. CSR" (portrait): page 1 defines zones
 * A/B/C; then one printed page per zone-map page (the sheet's 5 picture
 * pages), each with the header repeated; then the compliance checklist.
 */
export async function CsrPrint({ ppapId }: { ppapId: string }) {
  const { element, sections } = await getCsrComplianceView(ppapId);
  const [signed, pages] = await Promise.all([
    prisma.ppapElement.findUniqueOrThrow({ where: { id: element.id }, include: { preparedBy: true, checkedBy: true, approvedBy: true } }),
    prisma.csrZoneMapPage.findMany({ where: { ppapElementId: element.id }, orderBy: { sortOrder: "asc" }, include: { views: { orderBy: { sortOrder: "asc" } } } }),
  ]);
  const header = <PrintHeader supplierName="Smorx" title="PPAP DOCUMENTS" subtitle="CSR - CUSTOMER SPECIFIC REQUIREMENTS" docNo={element.docNo} revision={element.revision} />;
  const zones = sections.filter((s) => s.isZone);
  const others = sections.filter((s) => !s.isZone);
  const summary = complianceSummary(sections.flatMap((s) => s.requirements.map((r) => r.compliance)));

  return (
    <div className="mx-auto max-w-4xl bg-white text-black">
      <style>{`
        @page { size: A4 portrait; margin: 10mm; }
        .csr-print-page { page-break-after: always; break-after: page; }
        .csr-print-page:last-child { page-break-after: auto; break-after: auto; }
      `}</style>

      {element.applicability === "NA" ? (
        <div className="csr-print-page p-4">
          {header}
          <p className="mt-4 text-sm">N/A — {element.naReason}</p>
        </div>
      ) : (
        <>
          {/* Page 1 — zone definitions */}
          <div className="csr-print-page p-4" data-testid="csr-print-definitions">
            {header}
            <h2 className="mt-3 text-center text-sm font-semibold underline">Definition of zones A/B/C</h2>
            {zones.map((z) => (
              <div key={z.id} className="mt-3 break-inside-avoid">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center border border-black text-base font-bold text-white" style={{ backgroundColor: z.colour ?? "#6b7280" }}>
                    {z.code}
                  </span>
                  <span className="text-xs font-semibold">{z.description ? `${z.description}:` : z.title}</span>
                </div>
                <ol className="ml-10 mt-1 space-y-0.5 text-[11px]">
                  {z.requirements.map((r) => (
                    <li key={r.id}>
                      {r.ruleNo}. {r.text}
                    </li>
                  ))}
                </ol>
                {z.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={z.imageUrl} alt={z.imageName ?? `${z.title} illustration`} className="mx-auto mt-2 max-h-[110mm]" />
                ) : null}
              </div>
            ))}
            {others.map((s) => (
              <div key={s.id} className="mt-3 break-inside-avoid">
                <div className="text-xs font-semibold">
                  {s.code}. {s.title}
                  {s.description ? ` — ${s.description}` : ""}
                </div>
                <ol className="ml-6 mt-1 space-y-0.5 text-[11px]">
                  {s.requirements.map((r) => (
                    <li key={r.id}>
                      {r.ruleNo}. {r.text}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>

          {/* Zone-map pages — one printed page each */}
          {pages.map((page) => {
            const perViewHeight = (PAGE_PICTURE_HEIGHT_MM - 8 * page.views.length) / Math.max(1, page.views.length);
            return (
              <div key={page.id} className="csr-print-page p-4" data-testid="csr-print-zone-page">
                {header}
                {page.views.map((v) => {
                  const crop = parseCrop(v.crop);
                  const aspect = cropLayout(crop, v.imageWidth, v.imageHeight).aspectRatio ?? 1;
                  const widthMm = Math.min(PAGE_WIDTH_MM, perViewHeight * aspect);
                  return (
                    <figure key={v.id} className="mx-auto mt-2" style={{ width: `${widthMm}mm` }} data-testid="csr-print-view">
                      {v.caption ? <figcaption className="mb-1 text-xs font-semibold">{v.caption}</figcaption> : null}
                      <ZonePicture imageUrl={v.imageUrl} alt={v.caption ?? v.imageName} width={v.imageWidth} height={v.imageHeight} crop={crop} annotations={parseAnnotations(v.annotations)} />
                    </figure>
                  );
                })}
              </div>
            );
          })}

          {/* Compliance checklist */}
          <div className="csr-print-page p-4" data-testid="csr-print-compliance">
            {header}
            <h2 className="mt-3 text-sm font-semibold">
              CSR compliance — {summary.complied} of {summary.total} complied
              {summary.notComplied ? `, ${summary.notComplied} not complied` : ""}
              {summary.pending ? `, ${summary.pending} not assessed` : ""}
            </h2>
            <table className="mt-2 w-full border-collapse border border-black text-[10px]" data-testid="csr-compliance-table">
              <thead>
                <tr className="bg-gray-100">
                  <th className={cell}>Zone / Rule</th>
                  <th className={cell}>Requirement</th>
                  <th className={cell}>Complied</th>
                  <th className={cell}>Evidence</th>
                  <th className={cell}>Remark</th>
                </tr>
              </thead>
              <tbody>
                {sections.flatMap((s) =>
                  s.requirements.map((r) => (
                    <tr key={r.id} className={r.compliance.complied === false ? "bg-red-100" : undefined}>
                      <td className={`${cell} whitespace-nowrap`}>
                        {s.code}
                        {r.ruleNo}
                      </td>
                      <td className={cell}>{r.text}</td>
                      <td className={`${cell} whitespace-nowrap`}>{r.compliance.complied === true ? "Y" : r.compliance.complied === false ? "N" : "Not assessed"}</td>
                      <td className={cell}>
                        {[
                          r.compliance.evidenceElementNo != null ? `${r.compliance.evidenceElementNo}. ${PPAP_ELEMENT_NAMES[r.compliance.evidenceElementNo]}` : null,
                          r.compliance.evidenceFileName,
                        ]
                          .filter(Boolean)
                          .join("; ")}
                      </td>
                      <td className={cell}>{r.compliance.remark ?? ""}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
            <PrintFooter
              entries={[
                { label: "Prepared By", name: signed.preparedBy?.name ?? null, date: signed.preparedAt },
                { label: "Checked By", name: signed.checkedBy?.name ?? null, date: signed.checkedAt },
                { label: "Approved By", name: signed.approvedBy?.name ?? null, date: signed.approvedAt },
              ]}
            />
          </div>
        </>
      )}
    </div>
  );
}
