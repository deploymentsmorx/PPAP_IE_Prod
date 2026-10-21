import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { canEditCustomerDisposition } from "@/lib/actions/customer-disposition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, ApplicabilityBadge } from "@/components/status-badge";
import { SignatureBlock } from "@/components/signature-block";
import { CustomerDisposition } from "@/components/customer-disposition";
import { CeaForm } from "@/components/ppap-pages/cea-form";

export async function CeaPage({ ppapId }: { ppapId: string }) {
  const ppap = await prisma.ppap.findUniqueOrThrow({
    where: { id: ppapId },
    include: { customer: true, partRevision: { include: { part: true } } },
  });

  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { ppapId_elementNo: { ppapId, elementNo: 3 } },
    include: {
      ceaDetail: { include: { declaredBy: true } },
      ceaAttachments: { orderBy: { uploadedAt: "desc" } },
      customerDisposition: { include: { recordedBy: true } },
    },
  });

  const requiredElements = await prisma.ppapElement.findMany({
    where: { ppapId, applicability: "REQUIRED" },
    select: { elementNo: true },
    orderBy: { elementNo: "asc" },
  });

  const users = await prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  const locked = element.status === "APPROVED";
  const canEditDisposition = await canEditCustomerDisposition(ppapId);

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>3. Customer Engineering Approval (CEA)</CardTitle>
          <div className="flex items-center gap-2">
            <ApplicabilityBadge applicability={element.applicability} />
            <StatusBadge status={element.status} />
            <Button
              render={<Link href={`/ppap/${ppapId}/3/print`} target="_blank" />}
              nativeButton={false}
              variant="outline"
              size="sm"
            >
              Print
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {element.naReason ? (
            <p className="mb-4 rounded bg-muted px-3 py-2 text-sm text-muted-foreground">
              N/A — {element.naReason}
            </p>
          ) : (
            <CeaForm
              ppapElementId={element.id}
              locked={locked}
              master={{
                customerName: ppap.customer.name,
                supplierName: "Smorx",
                partName: ppap.partRevision.part.partName,
                partNumber: ppap.partRevision.part.partNumber,
                drawingNo: ppap.partRevision.drawingNo ?? "",
                drawingRevision: ppap.partRevision.revision,
                project: ppap.partRevision.part.projectModel ?? "",
                level: ppap.level,
                requiredElementNos: requiredElements.map((e) => e.elementNo),
              }}
              detail={element.ceaDetail}
              attachments={element.ceaAttachments}
              users={users}
            />
          )}

          <section className="mt-6 border-t pt-4">
            <h3 className="mb-2 text-sm font-semibold">10. Customer Approval</h3>
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
