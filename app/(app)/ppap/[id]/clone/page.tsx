import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClonePpapForm } from "@/components/clone-ppap-form";

export default async function ClonePpapPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("editSupplierData");
  const { id } = await params;
  const ppap = await prisma.ppap.findUnique({ where: { id }, include: { partRevision: { include: { part: true } } } });
  if (!ppap) notFound();
  const customers = await prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Clone PPAP</CardTitle>
          <p className="text-sm text-muted-foreground">
            Copies every page&apos;s data into a new PPAP — sign-offs, statuses and the revision start fresh. Not copied: the ECN log,
            customer dispositions, master samples, the PSW signature, and CSR compliance when the customer changes.
          </p>
        </CardHeader>
        <CardContent>
          <ClonePpapForm
            ppapId={ppap.id}
            source={{ customerId: ppap.customerId, partName: ppap.partRevision.part.partName, partNumber: ppap.partRevision.part.partNumber, approvalMode: ppap.approvalMode }}
            customers={customers}
          />
        </CardContent>
      </Card>
    </main>
  );
}
