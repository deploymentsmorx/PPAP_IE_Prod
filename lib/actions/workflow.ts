"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertSupplierUser } from "@/lib/permissions";
import { permissionsFor } from "@/lib/calc/permissions";
import { supersedeOlderMasterSamples } from "@/lib/master-sample";
import { assertPpapOpen } from "@/lib/psw-lifecycle";
import type { ElementStatus } from "@/app/generated/prisma/client";

async function requireUserId() {
  return (await assertSupplierUser()).id;
}

async function audit(params: {
  ppapId: string;
  userId: string;
  action: "UPDATE" | "APPROVE" | "REVISE";
  entityId: string;
  before: unknown;
  after: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      ppapId: params.ppapId,
      userId: params.userId,
      action: params.action,
      entityType: "PpapElement",
      entityId: params.entityId,
      before: params.before as never,
      after: params.after as never,
    },
  });
}

function revalidateElement(ppapId: string, elementNo: number) {
  revalidatePath(`/ppap/${ppapId}/${elementNo}`);
  revalidatePath(`/ppap/${ppapId}/${elementNo}/print`);
  revalidatePath(`/ppap/${ppapId}`);
  revalidatePath("/");
}

/**
 * Who prepared/checked/approved a page is often not whoever is clicking
 * the button (data entry on someone else's behalf, historical records,
 * shared logins) — so every stage names an explicit user rather than
 * defaulting to the current session user. Status is derived from which
 * stages are filled: Approved > Checked > Prepared; clearing all of them
 * drops back to In Progress. Approved still locks the page.
 */
export async function updateElementSignatures(
  ppapElementId: string,
  data: {
    preparedById: string | null;
    preparedAt: string | null;
    checkedById: string | null;
    checkedAt: string | null;
    approvedById: string | null;
    approvedAt: string | null;
  },
) {
  const actingUserId = await requireUserId();
  const before = await prisma.ppapElement.findUniqueOrThrow({ where: { id: ppapElementId } });
  if (before.status === "APPROVED") {
    throw new Error("This page is approved and locked. Use Revise to edit it.");
  }
  await assertPpapOpen(before.ppapId);

  const preparedById = data.preparedById || null;
  const preparedAt = preparedById ? new Date(data.preparedAt || new Date().toISOString()) : null;
  const checkedById = data.checkedById || null;
  const checkedAt = checkedById ? new Date(data.checkedAt || new Date().toISOString()) : null;
  const approvedById = data.approvedById || null;
  const approvedAt = approvedById ? new Date(data.approvedAt || new Date().toISOString()) : null;

  // Whoever is named as approver must hold approval rights (QA Manager / Admin).
  if (approvedById && approvedById !== before.approvedById) {
    const approver = await prisma.user.findUniqueOrThrow({ where: { id: approvedById }, select: { name: true, roles: true } });
    if (!permissionsFor(approver.roles).approvePages) {
      throw new Error(`${approver.name} can't approve pages — only a QA Manager or Admin can.`);
    }
  }

  let status: ElementStatus = before.status;
  if (approvedById) status = "APPROVED";
  else if (checkedById) status = "CHECKED";
  else if (preparedById) status = "PREPARED";
  else if (["PREPARED", "CHECKED", "APPROVED"].includes(status)) status = "IN_PROGRESS";

  const after = await prisma.ppapElement.update({
    where: { id: ppapElementId },
    data: { status, preparedById, preparedAt, checkedById, checkedAt, approvedById, approvedAt },
  });

  await audit({
    ppapId: after.ppapId,
    userId: actingUserId,
    action: status === "APPROVED" ? "APPROVE" : "UPDATE",
    entityId: after.id,
    before,
    after,
  });

  // Approving a newer revision's Master Sample supersedes the older
  // revisions' active master samples (CLAUDE.md / element 15).
  if (status === "APPROVED" && after.elementNo === 15) {
    const superseded = await supersedeOlderMasterSamples(after.ppapId, actingUserId);
    if (superseded.length > 0) revalidatePath("/(app)/ppap/[id]/[element]", "page");
  }
  revalidateElement(after.ppapId, after.elementNo);
}

/**
 * Reopens an APPROVED page for editing. Full before/after revision diffing
 * is a later enhancement — for now this bumps the revision counter, clears
 * the signatures, and logs a REVISE audit entry with a reason.
 */
export async function reviseElement(ppapElementId: string, reason: string) {
  const userId = await requireUserId();
  const before = await prisma.ppapElement.findUniqueOrThrow({ where: { id: ppapElementId } });
  if (before.status !== "APPROVED") {
    throw new Error("Only an approved page can be revised");
  }
  await assertPpapOpen(before.ppapId);
  const nextRevision = String(Number(before.revision) + 1).padStart(2, "0");
  const after = await prisma.ppapElement.update({
    where: { id: ppapElementId },
    data: {
      status: "IN_PROGRESS",
      revision: nextRevision,
      preparedById: null,
      preparedAt: null,
      checkedById: null,
      checkedAt: null,
      approvedById: null,
      approvedAt: null,
    },
  });
  await audit({
    ppapId: after.ppapId,
    userId,
    action: "REVISE",
    entityId: after.id,
    before,
    after: { ...after, reviseReason: reason },
  });
  revalidateElement(after.ppapId, after.elementNo);
}
