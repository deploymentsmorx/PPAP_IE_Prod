import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/permissions";
import { NewPpapForm } from "@/components/ppap-pages/new-ppap-form";

export default async function NewPpapPage() {
  await requirePagePermission("editSupplierData");
  // Select only plain-serializable fields — Prisma's Decimal fields
  // (weightKg, defaultCpk, etc.) can't cross the Server->Client boundary.
  const [customers, parts, partRevisions, materialSpecs] = await Promise.all([
    prisma.customer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, approvalMode: true, defaultPpapLevel: true },
    }),
    prisma.part.findMany({
      orderBy: { partName: "asc" },
      select: { id: true, partName: true, partNumber: true, customerId: true },
    }),
    prisma.partRevision.findMany({
      orderBy: { revision: "asc" },
      select: { id: true, partId: true, revision: true },
    }),
    prisma.materialSpec.findMany({
      orderBy: { grade: "asc" },
      select: { id: true, standard: true, grade: true },
    }),
  ]);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <NewPpapForm
        customers={customers}
        parts={parts}
        partRevisions={partRevisions}
        materialSpecs={materialSpecs}
      />
    </main>
  );
}
