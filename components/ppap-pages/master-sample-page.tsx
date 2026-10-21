import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDateIndia } from "@/lib/format";
import { getOtherRevisionMasterSamples } from "@/lib/master-sample";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, ApplicabilityBadge } from "@/components/status-badge";
import { SignatureBlock } from "@/components/signature-block";
import { NaToggle } from "@/components/na-toggle";
import { MasterSampleForm } from "@/components/ppap-pages/master-sample-form";

const STATUS_LABEL = { ACTIVE: "Active", SUPERSEDED: "Superseded", DISPOSED: "Disposed" } as const;

export async function MasterSamplePage({ ppapId }: { ppapId: string }) {
  const ppap = await prisma.ppap.findUniqueOrThrow({
    where: { id: ppapId },
    include: { customer: true, partRevision: { include: { part: true } } },
  });
  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { ppapId_elementNo: { ppapId, elementNo: 15 } },
    include: { masterSamples: { orderBy: { sortOrder: "asc" }, include: { images: { orderBy: { uploadedAt: "asc" } } } } },
  });

  const supersedingPpapIds = [...new Set(element.masterSamples.map((r) => r.supersededByPpapId).filter((id): id is string => !!id))];
  const [users, history, supersedingPpaps] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getOtherRevisionMasterSamples(ppapId),
    prisma.ppap.findMany({ where: { id: { in: supersedingPpapIds } }, include: { partRevision: true } }),
  ]);
  const revisionByPpapId = new Map(supersedingPpaps.map((p) => [p.id, p.partRevision.revision]));

  const locked = element.status === "APPROVED";
  const isNa = element.applicability === "NA";

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>15. Master Sample</CardTitle>
          <div className="flex items-center gap-2">
            <ApplicabilityBadge applicability={element.applicability} />
            <StatusBadge status={element.status} />
            <Button render={<Link href={`/ppap/${ppapId}/15/print`} target="_blank" />} nativeButton={false} variant="outline" size="sm">
              Print
            </Button>
            <Button render={<a href={`/api/ppap/${ppapId}/15/pdf`} />} nativeButton={false} variant="outline" size="sm">
              Download PDF
            </Button>
            <Button render={<a href={`/api/master-sample/${element.id}/export`} />} nativeButton={false} variant="outline" size="sm">
              Export Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <NaToggle
            ppapElementId={element.id}
            label="Master sample not required for this submission (N/A)"
            defaultReason="Not required per PPAP checklist"
            initialEnabled={isNa}
            initialReason={element.naReason ?? ""}
            locked={locked}
          />

          {isNa ? (
            <p className="rounded bg-muted px-3 py-2 text-sm text-muted-foreground">N/A — {element.naReason}</p>
          ) : (
            <>
              <MasterSampleForm
                ppapId={ppapId}
                ppapElementId={element.id}
                locked={locked}
                master={{
                  partName: ppap.partRevision.part.partName,
                  partNumber: ppap.partRevision.part.partNumber,
                  customerName: ppap.customer.name,
                  drawingNo: ppap.partRevision.drawingNo ?? ppap.partRevision.part.partNumber,
                  revision: ppap.partRevision.revision,
                  level: ppap.level,
                }}
                rows={element.masterSamples.map((r) => ({
                  ...r,
                  supersededByRevision: r.supersededByPpapId ? (revisionByPpapId.get(r.supersededByPpapId) ?? null) : null,
                }))}
              />

              <p className="text-xs text-muted-foreground">
                Approving this page (Approved By below) supersedes the active master samples of older revisions of this
                part. Expiry = approval date + retention period; a reminder shows from 30 days before expiry, here and on
                the PPAP list.
              </p>

              {history.length > 0 ? (
                <section className="space-y-2 rounded-md border p-3">
                  <h3 className="text-sm font-semibold">Other revisions of this part</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="p-1">Rev</th>
                        <th className="p-1">Sample ID</th>
                        <th className="p-1">Approval Date</th>
                        <th className="p-1">Expiry</th>
                        <th className="p-1">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h) => (
                        <tr key={h.id} className="border-b">
                          <td className="p-1">
                            <Link href={`/ppap/${h.ppapId}/15`} className="text-primary hover:underline">
                              Rev {h.revision}
                            </Link>
                          </td>
                          <td className="p-1">{h.sampleId}</td>
                          <td className="p-1">{formatDateIndia(h.approvalDate)}</td>
                          <td className="p-1">{formatDateIndia(h.expiry)}</td>
                          <td className="p-1">
                            {STATUS_LABEL[h.status]}
                            {h.supersededAt ? ` (${formatDateIndia(h.supersededAt)})` : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ) : null}
            </>
          )}

          <SignatureBlock
            ppapElementId={element.id}
            stages={["PREPARED", "APPROVED"]}
            status={element.status}
            users={users}
            prepared={{ byId: element.preparedById, at: element.preparedAt }}
            approved={{ byId: element.approvedById, at: element.approvedAt }}
          />
        </CardContent>
      </Card>
    </main>
  );
}
