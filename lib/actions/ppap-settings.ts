"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertSupplierUser } from "@/lib/permissions";
import type { ApprovalMode } from "@/app/generated/prisma/client";

/**
 * Editable per-PPAP until the PSW is submitted (per CLAUDE.md) — i.e.
 * while Ppap.status is OPEN. Every change is audit-logged with the reason,
 * per the original spec.
 */
export async function updateApprovalMode(ppapId: string, mode: ApprovalMode, reason: string) {
  const user = await assertSupplierUser();

  const before = await prisma.ppap.findUniqueOrThrow({ where: { id: ppapId } });
  if (before.status !== "OPEN") {
    throw new Error("The customer approval mode can't change once the PSW has been submitted.");
  }
  const after = await prisma.ppap.update({ where: { id: ppapId }, data: { approvalMode: mode } });

  await prisma.auditLog.create({
    data: {
      ppapId,
      userId: user.id,
      action: "UPDATE",
      entityType: "Ppap",
      entityId: ppapId,
      before: { approvalMode: before.approvalMode },
      after: { approvalMode: after.approvalMode, reason },
    },
  });

  revalidatePath(`/ppap/${ppapId}`);
}
