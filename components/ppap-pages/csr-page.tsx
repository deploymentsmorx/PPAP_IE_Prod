import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCsrComplianceView, getZoneCriteriaForCustomer } from "@/lib/csr";
import { complianceSummary, parseAnnotations, parseCrop } from "@/lib/calc/csr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, ApplicabilityBadge } from "@/components/status-badge";
import { SignatureBlock } from "@/components/signature-block";
import { NaToggle } from "@/components/na-toggle";
import { CsrComplianceForm } from "@/components/ppap-pages/csr-compliance-form";
import { ZoneMapEditor } from "@/components/csr/zone-map-editor";
import { AddZoneMapPageButton, ZoneMapPageControls } from "@/components/csr/zone-map-page-controls";

export async function CsrPage({ ppapId }: { ppapId: string }) {
  const { customer, element, sections } = await getCsrComplianceView(ppapId);
  const [pages, users, criteria] = await Promise.all([
    prisma.csrZoneMapPage.findMany({ where: { ppapElementId: element.id }, orderBy: { sortOrder: "asc" }, include: { views: { orderBy: { sortOrder: "asc" } } } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getZoneCriteriaForCustomer(customer.id),
  ]);
  const locked = element.status === "APPROVED";
  const isNa = element.applicability === "NA";
  const summary = complianceSummary(sections.flatMap((s) => s.requirements.map((r) => r.compliance)));
  const zoneA = criteria.zones.find((z) => z.code === "A")?.criteria;

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>17. Customer-Specific Requirements (CSR)</CardTitle>
          <div className="flex items-center gap-2">
            <ApplicabilityBadge applicability={element.applicability} />
            <StatusBadge status={element.status} />
            <Button render={<Link href={`/csr?customer=${customer.id}`} />} nativeButton={false} variant="outline" size="sm">
              {customer.name} CSR library
            </Button>
            <Button render={<Link href={`/ppap/${ppapId}/17/print`} target="_blank" />} nativeButton={false} variant="outline" size="sm">
              Print
            </Button>
            <Button render={<a href={`/api/ppap/${ppapId}/17/pdf`} />} nativeButton={false} variant="outline" size="sm">
              Download PDF
            </Button>
            <Button render={<a href={`/api/csr-export/${element.id}`} />} nativeButton={false} variant="outline" size="sm">
              Export Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <NaToggle
            ppapElementId={element.id}
            label="No customer-specific requirements for this submission (N/A)"
            defaultReason="Not required per PPAP checklist"
            initialEnabled={isNa}
            initialReason={element.naReason ?? ""}
            locked={locked}
          />

          {isNa ? (
            <p className="rounded bg-muted px-3 py-2 text-sm text-muted-foreground">N/A — {element.naReason}</p>
          ) : (
            <>
              <section className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold">Requirements &amp; compliance</h3>
                  <span className="text-sm" data-testid="csr-summary">
                    {summary.complied} of {summary.total} complied · {summary.notComplied} not complied · {summary.pending} not assessed
                  </span>
                </div>
                {sections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {customer.name} has no CSR library yet —{" "}
                    <Link href={`/csr?customer=${customer.id}`} className="text-primary hover:underline">
                      add its sections and requirements
                    </Link>
                    .
                  </p>
                ) : (
                  <CsrComplianceForm
                    ppapId={ppapId}
                    ppapElementId={element.id}
                    locked={locked}
                    sections={sections.map((s) => ({
                      id: s.id,
                      code: s.code,
                      title: s.title,
                      description: s.description,
                      colour: s.colour,
                      rows: s.requirements.map((r) => ({ requirementId: r.id, ruleNo: r.ruleNo, text: r.text, compliance: r.compliance })),
                    }))}
                  />
                )}
                {zoneA && (zoneA.gloss || zoneA.minDftUm || zoneA.viewingDistanceM) ? (
                  <p className="text-xs text-muted-foreground">
                    Used by 13. AAR as acceptance criteria (zone A):{" "}
                    {[
                      zoneA.gloss ? `gloss ${zoneA.gloss.minPct}–${zoneA.gloss.maxPct}% at ${zoneA.gloss.angleDeg}°` : null,
                      zoneA.minDftUm ? `DFT ≥ ${zoneA.minDftUm.value} µm` : null,
                      zoneA.viewingDistanceM ? `viewed from ${zoneA.viewingDistanceM.value} m` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    . API: <code>/api/csr/{customer.id}/zones</code>
                  </p>
                ) : null}
              </section>

              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Zone maps</h3>
                  {!locked ? <AddZoneMapPageButton ppapElementId={element.id} /> : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  One page per printed sheet page. Upload a picture per view, then drag rectangles or click polygons to mark
                  Visible Area A / Moderately Visible Area B.
                </p>
                {pages.map((page, p) => (
                  <div key={page.id} className="space-y-2 rounded-md border p-3" data-testid="zone-map-page">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold">Zone-map page {p + 1}</h4>
                      {!locked ? <ZoneMapPageControls pageId={page.id} ppapElementId={element.id} pageNo={p + 1} /> : null}
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {page.views.map((v) => (
                        <ZoneMapEditor
                          key={v.id}
                          ppapElementId={element.id}
                          locked={locked}
                          view={{
                            id: v.id,
                            imageUrl: v.imageUrl,
                            imageName: v.imageName,
                            imageWidth: v.imageWidth,
                            imageHeight: v.imageHeight,
                            crop: parseCrop(v.crop),
                            caption: v.caption,
                            annotations: parseAnnotations(v.annotations),
                          }}
                        />
                      ))}
                      {page.views.length === 0 ? <p className="text-sm text-muted-foreground">No pictures on this page yet.</p> : null}
                    </div>
                  </div>
                ))}
                {pages.length === 0 ? <p className="text-sm text-muted-foreground">No zone-map pages yet.</p> : null}
              </section>
            </>
          )}

          <SignatureBlock
            ppapElementId={element.id}
            stages={["PREPARED", "CHECKED", "APPROVED"]}
            status={element.status}
            users={users}
            prepared={{ byId: element.preparedById, at: element.preparedAt }}
            checked={{ byId: element.checkedById, at: element.checkedAt }}
            approved={{ byId: element.approvedById, at: element.approvedAt }}
          />
        </CardContent>
      </Card>
    </main>
  );
}
