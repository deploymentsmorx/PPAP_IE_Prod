import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { formatDateIndia } from "@/lib/format";
import { sampleTagPayload } from "@/lib/calc/spp";
import { masterSampleExpiry, masterSampleTagPayload } from "@/lib/calc/master-sample";

type Tag = { id: string; heading: string; sampleId: string; lines: [string, string][]; payload: string };

/**
 * Printable QR tags: element 14 (one per registered production sample) and
 * element 15 (one per master sample). Lives beside /print under [element]
 * (a static "14"/"15" folder would shadow /ppap/[id]/14/print) and 404s for
 * other elements.
 */
export default async function SampleTagsPage({ params }: { params: Promise<{ id: string; element: string }> }) {
  const { id, element } = await params;
  if (element !== "14" && element !== "15") notFound();

  const ppap = await prisma.ppap.findUnique({ where: { id }, include: { partRevision: { include: { part: true } } } });
  if (!ppap) notFound();
  const part = ppap.partRevision.part;
  const revision = ppap.partRevision.revision;

  let tags: Tag[];
  if (element === "14") {
    const spp = await prisma.ppapElement.findUniqueOrThrow({
      where: { ppapId_elementNo: { ppapId: id, elementNo: 14 } },
      include: { sppDetail: true, sppSamples: { orderBy: { sortOrder: "asc" } } },
    });
    tags = spp.sppSamples.map((s) => {
      const dateValue = s.manufacturingDate ?? spp.sppDetail?.reportDate ?? null;
      const date = dateValue ? formatDateIndia(dateValue) : null;
      const lines: [string, string][] = [
        ["Part", part.partName],
        ["Part No", part.partNumber],
        ["Rev", revision],
        ["Date", date ?? "-"],
      ];
      if (s.lotBatchNo) lines.push(["Lot/Batch", s.lotBatchNo]);
      return {
        id: s.id,
        heading: "PPAP Sample — Ingenious Engineering",
        sampleId: s.sampleId,
        lines,
        payload: sampleTagPayload({ sampleId: s.sampleId, partNumber: part.partNumber, revision, date }),
      };
    });
  } else {
    const ms = await prisma.ppapElement.findUniqueOrThrow({
      where: { ppapId_elementNo: { ppapId: id, elementNo: 15 } },
      include: { masterSamples: { orderBy: { sortOrder: "asc" } } },
    });
    tags = ms.masterSamples.map((r) => {
      const approval = r.approvalDate ? formatDateIndia(r.approvalDate) : null;
      const expiryDate = masterSampleExpiry(r.approvalDate, r.retentionYears);
      const expiry = expiryDate ? formatDateIndia(expiryDate) : null;
      return {
        id: r.id,
        heading: "MASTER SAMPLE — Ingenious Engineering",
        sampleId: r.sampleId,
        lines: [
          ["Part", part.partName],
          ["Part No", part.partNumber],
          ["Rev", revision],
          ["Approved", approval ?? "-"],
          ["Expiry", expiry ?? "-"],
          ["Location", r.storageLocation ?? "-"],
        ],
        payload: masterSampleTagPayload({ sampleId: r.sampleId, partNumber: part.partNumber, revision, approvalDate: approval, expiry, location: r.storageLocation }),
      };
    });
  }

  const rendered = await Promise.all(
    tags.map(async (t) => ({ ...t, svg: await QRCode.toString(t.payload, { type: "svg", margin: 0, errorCorrectionLevel: "M" }) })),
  );

  return (
    <div className="bg-white p-6 text-black print:p-0">
      <style>{`@page { size: A4 portrait; margin: 10mm; }`}</style>
      {rendered.length === 0 ? (
        <p className="text-sm">{element === "14" ? "No samples registered on 14. Sample Production Part yet." : "No master samples registered on 15. Master Sample yet."}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {rendered.map((t) => (
            <div key={t.id} className="flex break-inside-avoid gap-3 border-2 border-black p-3" data-testid="sample-tag">
              <div className="h-28 w-28 shrink-0 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: t.svg }} />
              <div className="min-w-0 space-y-0.5 text-xs">
                <div className="text-[10px] font-semibold uppercase tracking-wide">{t.heading}</div>
                <div className="text-lg font-bold leading-tight">{t.sampleId}</div>
                {t.lines.map(([label, value]) => (
                  <div key={label}>
                    <span className="font-medium">{label}:</span> {value}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
