import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { canEditCustomerDisposition } from "@/lib/actions/customer-disposition";
import { getSppReadOnlyData } from "@/lib/spp";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, ApplicabilityBadge } from "@/components/status-badge";
import { SignatureBlock } from "@/components/signature-block";
import { CustomerDisposition } from "@/components/customer-disposition";
import { NaToggle } from "@/components/na-toggle";
import { SppForm } from "@/components/ppap-pages/spp-form";
import {
  SppGeneralSection,
  SppMaterialSection,
  SppDimensionalSection,
  SppAppearanceSection,
  SppProcessSection,
  SppMsaSection,
} from "@/components/ppap-pages/spp-readonly";

export async function SppPage({ ppapId }: { ppapId: string }) {
  const ppap = await prisma.ppap.findUniqueOrThrow({ where: { id: ppapId } });
  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { ppapId_elementNo: { ppapId, elementNo: 14 } },
    include: {
      sppDetail: { include: { declaredBy: true } },
      sppSamples: { orderBy: { sortOrder: "asc" } },
      sppFunctionalTests: { orderBy: { sortOrder: "asc" } },
      sppPackagingPhotos: { orderBy: { uploadedAt: "asc" } },
      customerDisposition: { include: { recordedBy: true } },
    },
  });

  const [users, readOnly, canEditDisposition] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getSppReadOnlyData(ppapId),
    canEditCustomerDisposition(ppapId),
  ]);

  const locked = element.status === "APPROVED";
  const isNa = element.applicability === "NA";

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>14. Sample Production Part</CardTitle>
          <div className="flex items-center gap-2">
            <ApplicabilityBadge applicability={element.applicability} />
            <StatusBadge status={element.status} />
            <Button render={<Link href={`/ppap/${ppapId}/14/print`} target="_blank" />} nativeButton={false} variant="outline" size="sm">
              Print
            </Button>
            <Button render={<a href={`/api/ppap/${ppapId}/14/pdf`} />} nativeButton={false} variant="outline" size="sm">
              Download PDF
            </Button>
            <Button render={<a href={`/api/spp/${element.id}/export`} />} nativeButton={false} variant="outline" size="sm">
              Export Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <NaToggle
            ppapElementId={element.id}
            label="Sample production parts not required for this submission (N/A)"
            defaultReason="Not required per PPAP checklist"
            initialEnabled={isNa}
            initialReason={element.naReason ?? ""}
            locked={locked}
          />

          {isNa ? (
            <p className="mb-4 rounded bg-muted px-3 py-2 text-sm text-muted-foreground">N/A — {element.naReason}</p>
          ) : (
            <>
              <SppForm
                ppapId={ppapId}
                ppapElementId={element.id}
                locked={locked}
                detail={element.sppDetail}
                samples={element.sppSamples}
                tests={element.sppFunctionalTests}
                photos={element.sppPackagingPhotos}
                users={users}
                slots={{
                  general: (
                    <SppGeneralSection ppapId={ppapId} data={readOnly.general} reportDate={element.sppDetail?.reportDate ?? null} locked={locked} />
                  ),
                  material: <SppMaterialSection ppapId={ppapId} data={readOnly.material} />,
                  dimensional: <SppDimensionalSection ppapId={ppapId} data={readOnly.dimensional} />,
                  appearance: <SppAppearanceSection ppapId={ppapId} data={readOnly.appearance} />,
                  process: <SppProcessSection ppapId={ppapId} data={readOnly.process} />,
                  msa: <SppMsaSection ppapId={ppapId} data={readOnly.msa} />,
                }}
              />

              <section className="mt-6 border-t pt-4">
                <h3 className="mb-2 text-sm font-semibold">11. Customer Approval</h3>
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
