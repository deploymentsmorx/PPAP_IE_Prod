import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { canEditCustomerDisposition } from "@/lib/actions/customer-disposition";
import { ensureAarCriteriaRows, getLabPaintResultsForPpap, getSupplierForHeader } from "@/lib/aar";
import { getSppSampleIdsForPpap } from "@/lib/spp";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, ApplicabilityBadge } from "@/components/status-badge";
import { SignatureBlock } from "@/components/signature-block";
import { CustomerDisposition } from "@/components/customer-disposition";
import { NaToggle } from "@/components/na-toggle";
import { AarForm } from "@/components/ppap-pages/aar-form";

export async function AarPage({ ppapId }: { ppapId: string }) {
  const ppap = await prisma.ppap.findUniqueOrThrow({
    where: { id: ppapId },
    include: { customer: true, partRevision: { include: { part: true } } },
  });

  const elementId = (await prisma.ppapElement.findUniqueOrThrow({ where: { ppapId_elementNo: { ppapId, elementNo: 13 } } })).id;
  await ensureAarCriteriaRows(elementId, ppapId);

  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { id: elementId },
    include: {
      aarDetail: true,
      aarCriteriaRows: { orderBy: { sortOrder: "asc" }, include: { photos: { orderBy: { uploadedAt: "asc" } } } },
      customerDisposition: { include: { recordedBy: true } },
    },
  });

  const [users, supplier, labResults, canEditDisposition, sppSampleIds] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getSupplierForHeader(),
    getLabPaintResultsForPpap(ppapId),
    canEditCustomerDisposition(ppapId),
    getSppSampleIdsForPpap(ppapId),
  ]);

  const locked = element.status === "APPROVED";
  const isNa = element.applicability === "NA";

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>13. Appearance Approval Report (AAR)</CardTitle>
          <div className="flex items-center gap-2">
            <ApplicabilityBadge applicability={element.applicability} />
            <StatusBadge status={element.status} />
            <Button render={<Link href={`/ppap/${ppapId}/13/print`} target="_blank" />} nativeButton={false} variant="outline" size="sm">
              Print
            </Button>
            <Button render={<a href={`/api/ppap/${ppapId}/13/pdf`} />} nativeButton={false} variant="outline" size="sm">
              Download PDF
            </Button>
            <Button render={<a href={`/api/aar/${element.id}/export`} />} nativeButton={false} variant="outline" size="sm">
              Export Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <NaToggle
            ppapElementId={element.id}
            label="AAR not required for this submission (N/A)"
            defaultReason="Not required per PPAP checklist"
            initialEnabled={isNa}
            initialReason={element.naReason ?? ""}
            locked={locked}
          />

          {isNa ? (
            <p className="mb-4 rounded bg-muted px-3 py-2 text-sm text-muted-foreground">N/A — {element.naReason}</p>
          ) : (
            <>
              <AarForm
                ppapElementId={element.id}
                locked={locked}
                master={{
                  supplierName: supplier.name,
                  supplierCode: supplier.code,
                  customerName: ppap.customer.name,
                  partName: ppap.partRevision.part.partName,
                  partNumber: ppap.partRevision.part.partNumber,
                  revision: ppap.partRevision.revision,
                  level: ppap.level,
                }}
                detail={element.aarDetail}
                rows={element.aarCriteriaRows}
                labResults={labResults}
                sppSampleIds={sppSampleIds}
              />

              <section className="mt-6 border-t pt-4">
                <h3 className="mb-2 text-sm font-semibold">6. Customer Approval</h3>
                <CustomerDisposition
                  ppapElementId={element.id}
                  approvalMode={ppap.approvalMode}
                  canEdit={canEditDisposition}
                  locked={locked}
                  disposition={
                    element.customerDisposition
                      ? {
                          status: element.customerDisposition.status,
                          comments: element.customerDisposition.comments,
                          customerName: element.customerDisposition.customerName,
                          customerDesignation: element.customerDisposition.customerDesignation,
                          customerSignatureDate: element.customerDisposition.customerSignatureDate,
                          signedFileUrl: element.customerDisposition.signedFileUrl,
                          signedFileName: element.customerDisposition.signedFileName,
                          recordedByName: element.customerDisposition.recordedBy?.name ?? null,
                        }
                      : null
                  }
                />
              </section>
            </>
          )}

          <SignatureBlock
            ppapElementId={element.id}
            stages={["PREPARED", "CHECKED", "APPROVED"]}
            labels={{ PREPARED: "Prepared By (Supplier QA)", CHECKED: "Reviewed By", APPROVED: "Approved By" }}
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
