"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { saveUploadedFile } from "@/lib/storage";
import { canUserEditDisposition } from "@/lib/customer-disposition-permission";
import { applyPswDisposition, assertPpapOpen } from "@/lib/psw-lifecycle";
import type { CustomerDispositionStatus } from "@/app/generated/prisma/client";

async function requireCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { id: true, name: true, roles: true, customerId: true },
  });
}

/**
 * Whether the current session user is allowed to edit this element's
 * customer disposition, given the PPAP's approval mode. Exported so pages
 * can decide up front whether to render the form as editable or read-only.
 */
export async function canEditCustomerDisposition(ppapId: string): Promise<boolean> {
  const ppap = await prisma.ppap.findUniqueOrThrow({ where: { id: ppapId }, select: { approvalMode: true, customerId: true } });

  const session = await auth();
  const user = session?.user?.id
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { roles: true, customerId: true } })
    : null;

  return canUserEditDisposition(user, ppap);
}

export async function saveCustomerDisposition(ppapElementId: string, formData: FormData) {
  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { id: ppapElementId },
    include: { ppap: { select: { id: true, approvalMode: true, customerId: true } } },
  });
  if (element.status === "APPROVED") {
    throw new Error("This page is approved and locked. Use Revise to edit it.");
  }
  await assertPpapOpen(element.ppapId);

  const user = await requireCurrentUser();
  const mode = element.ppap.approvalMode;

  if (!canUserEditDisposition(user, { approvalMode: mode, customerId: element.ppap.customerId })) {
    throw new Error("Only that customer's approver can record this disposition in customer-portal mode.");
  }

  const statusRaw = formData.get("status");
  const status = (statusRaw ? String(statusRaw) : null) as CustomerDispositionStatus | null;
  const comments = (formData.get("comments") as string | null) || null;
  const customerName = (formData.get("customerName") as string | null) || null;
  const customerDesignation = (formData.get("customerDesignation") as string | null) || null;
  const dateRaw = formData.get("customerSignatureDate") as string | null;
  const customerSignatureDate = dateRaw ? new Date(dateRaw) : null;

  const existing = await prisma.customerDisposition.findUnique({ where: { ppapElementId } });

  let signedFileUrl = existing?.signedFileUrl ?? null;
  let signedFileName = existing?.signedFileName ?? null;
  const file = formData.get("signedFile");
  if (file instanceof File && file.size > 0) {
    const saved = await saveUploadedFile(file, `ppap-elements/${ppapElementId}/customer-disposition`);
    signedFileUrl = saved.url;
    signedFileName = saved.fileName;
  }

  if (mode === "SUPPLIER_UPLOAD" && !signedFileUrl) {
    throw new Error("Upload the signed copy before saving, in supplier-upload mode.");
  }

  // The PSW's disposition closes or re-opens the whole PPAP. It throws
  // (before writing) if the PSW isn't signed or a rejection has no comments.
  const pswStatus = element.elementNo === 18 ? await applyPswDisposition(ppapElementId, status, comments) : null;

  await prisma.customerDisposition.upsert({
    where: { ppapElementId },
    update: { status, comments, customerName, customerDesignation, customerSignatureDate, recordedById: user.id, signedFileUrl, signedFileName },
    create: { ppapElementId, status, comments, customerName, customerDesignation, customerSignatureDate, recordedById: user.id, signedFileUrl, signedFileName },
  });

  let elementStatus = element.status;
  if (pswStatus) elementStatus = pswStatus;
  else if (status === "APPROVED") elementStatus = "CUSTOMER_APPROVED";
  else if (status === "REJECTED") elementStatus = "CUSTOMER_REJECTED";
  else if (status === "CONDITIONAL") elementStatus = "IN_PROGRESS";

  await prisma.ppapElement.update({ where: { id: ppapElementId }, data: { status: elementStatus } });
  await prisma.auditLog.create({
    data: {
      ppapId: element.ppapId,
      userId: user.id,
      action: "UPDATE",
      entityType: "CustomerDisposition",
      entityId: ppapElementId,
      after: { status, mode, recordedBy: user.name },
    },
  });

  revalidatePath(`/ppap/${element.ppapId}/${element.elementNo}`);
  revalidatePath(`/ppap/${element.ppapId}/${element.elementNo}/print`);
  revalidatePath(`/ppap/${element.ppapId}`, element.elementNo === 18 ? "layout" : "page");
}
