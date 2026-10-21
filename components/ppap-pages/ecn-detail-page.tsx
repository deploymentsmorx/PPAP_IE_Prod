import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EcnDetailForm } from "@/components/ppap-pages/ecn-detail-form";

export async function EcnDetailPage({ ppapId, ecnId }: { ppapId: string; ecnId: string }) {
  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { ppapId_elementNo: { ppapId, elementNo: 2 } },
  });
  const locked = element.status === "APPROVED";

  const users = await prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  if (ecnId === "new") {
    const ppap = await prisma.ppap.findUniqueOrThrow({
      where: { id: ppapId },
      include: { customer: true, partRevision: { include: { part: true } } },
    });

    return (
      <EcnDetailForm
        ppapId={ppapId}
        ppapElementId={element.id}
        ecn={null}
        locked={locked}
        users={users}
        masterDefaults={{
          partNameSnapshot: ppap.partRevision.part.partName,
          partNumberSnapshot: ppap.partRevision.part.partNumber,
          customerNameSnapshot: ppap.customer.name,
          drawingNumberSnapshot: ppap.partRevision.drawingNo ?? "",
          drawingRevisionSnapshot: ppap.partRevision.revision,
        }}
        newRevisionLabel={null}
      />
    );
  }

  const ecn = await prisma.ecnRecord.findUnique({
    where: { id: ecnId },
    include: { newPartRevision: { select: { revision: true } } },
  });
  if (!ecn || ecn.ppapElementId !== element.id) {
    notFound();
  }

  return (
    <EcnDetailForm
      ppapId={ppapId}
      ppapElementId={element.id}
      ecn={ecn}
      locked={locked || ecn.status === "APPROVED"}
      users={users}
      masterDefaults={null}
      newRevisionLabel={ecn.newPartRevision?.revision ?? null}
    />
  );
}
