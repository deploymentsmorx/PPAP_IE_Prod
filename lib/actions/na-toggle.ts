"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeChecklistRequired } from "@/lib/checklist-sync";
import { assertPpapOpen } from "@/lib/psw-lifecycle";
import { assertSupplierUser } from "@/lib/permissions";

/**
 * Shared "mark this element N/A with a reason" toggle, used by any page
 * with a checkbox like ECN's "No engineering change" or DFMEA's
 * "Customer design – not in our scope". Unchecking reverts to REQUIRED.
 * Also writes "N"/"Y" into the PPAP Checklist's Required cell for this
 * element (two-way sync — see lib/checklist-sync.ts).
 */
export async function setElementNaToggle(ppapElementId: string, enabled: boolean, reason: string, defaultReason: string) {
  await assertSupplierUser();
  const element = await prisma.ppapElement.findUniqueOrThrow({ where: { id: ppapElementId } });
  if (element.status === "APPROVED") {
    throw new Error("This page is approved and locked. Use Revise to edit it.");
  }
  await assertPpapOpen(element.ppapId);

  const after = await prisma.ppapElement.update({
    where: { id: ppapElementId },
    data: enabled
      ? { applicability: "NA", naReason: reason || defaultReason }
      : { applicability: "REQUIRED", naReason: null },
  });
  await writeChecklistRequired(element.ppapId, element.elementNo, after.applicability);

  const session = await auth();
  await prisma.auditLog.create({
    data: {
      ppapId: element.ppapId,
      userId: session?.user?.id ?? null,
      action: "UPDATE",
      entityType: "PpapElement",
      entityId: ppapElementId,
      before: { applicability: element.applicability, naReason: element.naReason },
      after: { applicability: after.applicability, naReason: after.naReason },
    },
  });

  revalidatePath(`/ppap/${element.ppapId}/${element.elementNo}`);
  revalidatePath(`/ppap/${element.ppapId}/${element.elementNo}/print`);
  revalidatePath(`/ppap/${element.ppapId}/0`);
  revalidatePath(`/ppap/${element.ppapId}/0/print`);
  revalidatePath(`/ppap/${element.ppapId}`);
  revalidatePath("/");
}
