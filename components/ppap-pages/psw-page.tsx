import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPswView } from "@/lib/psw";
import { canEditCustomerDisposition } from "@/lib/actions/customer-disposition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, ApplicabilityBadge } from "@/components/status-badge";
import { CustomerDisposition } from "@/components/customer-disposition";
import { PswForm } from "@/components/ppap-pages/psw-form";
import { ConsistencyPanel } from "@/components/consistency-panel";
import { runConsistencyChecks } from "@/lib/consistency";

export async function PswPage({ ppapId }: { ppapId: string }) {
  const view = await getPswView(ppapId);
  const { ppap, element, detail, disposition } = view;
  const session = await auth();
  const [me, canEditDisposition, issues] = await Promise.all([
    session?.user?.id ? prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, designation: true } }) : null,
    canEditCustomerDisposition(ppapId),
    runConsistencyChecks(ppapId),
  ]);
  const checkErrors = issues.filter((i) => i.severity === "ERROR").length;
  const closed = ppap.status === "CLOSED";

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>18. Part Submission Warrant (PSW)</CardTitle>
          <div className="flex items-center gap-2">
            <ApplicabilityBadge applicability={element.applicability} />
            <StatusBadge status={element.status} />
            <Button render={<Link href={`/ppap/${ppapId}/18/print`} target="_blank" />} nativeButton={false} variant="outline" size="sm">
              Print
            </Button>
            <Button render={<a href={`/api/ppap/${ppapId}/18/pdf`} />} nativeButton={false} variant="outline" size="sm">
              Download PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <ConsistencyPanel ppapId={ppapId} issues={issues} />
          <PswForm
            checkErrors={checkErrors}
            ppapId={ppapId}
            ppapElementId={element.id}
            closed={closed}
            disposed={!!disposition?.status}
            detail={
              detail
                ? { ...detail, signedByName: detail.signedBy?.name ?? null, signedBySignatureUrl: detail.signedBy?.signatureUrl ?? null }
                : null
            }
            defaults={{ ...view.defaults, printName: me?.name ?? null, title: me?.designation ?? null }}
            auto={{ ...view.partInfo, supplier: view.supplierInfo, submission: view.submissionInfo }}
            level={view.level}
            results={view.results}
            missing={view.gate.missing}
          />

          <section className="border-t pt-4">
            <h3 className="mb-1 text-sm font-semibold">For Customer Use Only — Part Disposition</h3>
            <p className="mb-2 text-xs text-muted-foreground">
              Approved closes the PPAP; Rejected re-opens it with your comments (the supplier must correct and re-sign). Return a signed copy of the
              warrant to the supplier.
            </p>
            {detail?.signedAt || disposition?.status ? (
              <CustomerDisposition
                ppapElementId={element.id}
                approvalMode={ppap.approvalMode}
                canEdit={canEditDisposition}
                locked={closed}
                statusLabels={{ CONDITIONAL: "Other" }}
                disposition={
                  disposition
                    ? {
                        status: disposition.status,
                        comments: disposition.comments,
                        customerName: disposition.customerName,
                        customerDesignation: disposition.customerDesignation,
                        customerSignatureDate: disposition.customerSignatureDate,
                        signedFileUrl: disposition.signedFileUrl,
                        signedFileName: disposition.signedFileName,
                        recordedByName: disposition.recordedBy?.name ?? null,
                      }
                    : null
                }
              />
            ) : (
              <p className="text-sm text-muted-foreground">Available once the supplier has signed the PSW.</p>
            )}
          </section>
        </CardContent>
      </Card>
    </main>
  );
}
