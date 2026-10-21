"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertSupplierUser } from "@/lib/permissions";
import { createPpapElements } from "@/lib/ppap";
import { nextRevisionLetter } from "@/lib/revision";
import { setElementNaToggle } from "@/lib/actions/na-toggle";
import type { EcnStatus } from "@/app/generated/prisma/client";

async function assertEditable(ppapElementId: string) {
  await assertSupplierUser();
  const element = await prisma.ppapElement.findUniqueOrThrow({ where: { id: ppapElementId } });
  if (element.status === "APPROVED") {
    throw new Error("This page is approved and locked. Use Revise to edit it.");
  }
  return element;
}

function str(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

function dateOrNull(v: string | undefined): Date | null {
  return v ? new Date(v) : null;
}

const changeTypeEnum = z.enum(["DESIGN", "PROCESS", "MATERIAL"]).optional();
const impactLevelEnum = z.enum(["LOW", "MEDIUM", "HIGH"]).optional();
const stockDispositionEnum = z.enum(["USE", "REJECT", "REWORK"]).optional();

export async function saveEcn(ecnId: string | null, ppapElementId: string, formData: FormData) {
  const element = await assertEditable(ppapElementId);

  const ecnNumber = str(formData, "ecnNumber");
  if (!ecnNumber) throw new Error("ECN number is required");

  const preparedById = str(formData, "preparedById") ?? null;
  const reviewedById = str(formData, "reviewedById") ?? null;
  const approvedById = str(formData, "approvedById") ?? null;

  let status: EcnStatus = "DRAFT";
  if (approvedById) status = "APPROVED";
  else if (reviewedById) status = "REVIEWED";

  const affectedElementNos = formData
    .getAll("affectedElementNos")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n));

  const data = {
    ecnNumber,
    ecnDate: dateOrNull(str(formData, "ecnDate")),
    partNameSnapshot: str(formData, "partNameSnapshot") ?? null,
    partNumberSnapshot: str(formData, "partNumberSnapshot") ?? null,
    customerNameSnapshot: str(formData, "customerNameSnapshot") ?? null,
    drawingNumberSnapshot: str(formData, "drawingNumberSnapshot") ?? null,
    drawingRevisionSnapshot: str(formData, "drawingRevisionSnapshot") ?? null,
    department: str(formData, "department") ?? null,
    changeType: changeTypeEnum.parse(str(formData, "changeType")) ?? null,
    reason: str(formData, "reason") ?? null,
    existingCondition: str(formData, "existingCondition") ?? null,
    proposedChange: str(formData, "proposedChange") ?? null,
    impactQualityLevel: impactLevelEnum.parse(str(formData, "impactQualityLevel")) ?? null,
    impactQualityNote: str(formData, "impactQualityNote") ?? null,
    impactCostLevel: impactLevelEnum.parse(str(formData, "impactCostLevel")) ?? null,
    impactCostNote: str(formData, "impactCostNote") ?? null,
    impactDeliveryLevel: impactLevelEnum.parse(str(formData, "impactDeliveryLevel")) ?? null,
    impactDeliveryNote: str(formData, "impactDeliveryNote") ?? null,
    affectedElementNos,
    affectedDocsFreeText: str(formData, "affectedDocsFreeText") ?? null,
    stockDisposition: stockDispositionEnum.parse(str(formData, "stockDisposition")) ?? null,
    implementationDate: dateOrNull(str(formData, "implementationDate")),
    status,
    preparedById,
    preparedAt: preparedById ? dateOrNull(str(formData, "preparedAt")) : null,
    reviewedById,
    reviewedAt: reviewedById ? dateOrNull(str(formData, "reviewedAt")) : null,
    approvedById,
    approvedAt: approvedById ? dateOrNull(str(formData, "approvedAt")) : null,
  };

  let wasApprovedBefore = false;
  if (ecnId) {
    const existing = await prisma.ecnRecord.findUniqueOrThrow({ where: { id: ecnId } });
    wasApprovedBefore = existing.status === "APPROVED";
  }

  let ecn = ecnId
    ? await prisma.ecnRecord.update({ where: { id: ecnId }, data })
    : await prisma.ecnRecord.create({ data: { ppapElementId, ...data } });

  // Side effects on the APPROVED transition only.
  if (status === "APPROVED" && !wasApprovedBefore) {
    const ppapElement = await prisma.ppapElement.findUniqueOrThrow({
      where: { id: ppapElementId },
      include: { ppap: { include: { partRevision: true } } },
    });
    const currentRevision = ppapElement.ppap.partRevision;
    const nextRevision = nextRevisionLetter(currentRevision.revision);

    const newPartRevision = await prisma.partRevision.create({
      data: {
        partId: currentRevision.partId,
        revision: nextRevision,
        drawingNo: currentRevision.drawingNo,
        status: "ACTIVE",
      },
    });

    ecn = await prisma.ecnRecord.update({
      where: { id: ecn.id },
      data: { newPartRevisionId: newPartRevision.id },
    });

    if (ecn.affectedElementNos.length) {
      await prisma.ppapElement.updateMany({
        where: { ppapId: ppapElement.ppapId, elementNo: { in: ecn.affectedElementNos } },
        data: { revisionRequired: true },
      });
    }
  }

  revalidatePath(`/ppap/${element.ppapId}/2`);
  revalidatePath(`/ppap/${element.ppapId}/2/${ecn.id}`);
  revalidatePath(`/ppap/${element.ppapId}`);
  return ecn;
}

export async function deleteEcn(ecnId: string, ppapElementId: string) {
  const element = await assertEditable(ppapElementId);
  await prisma.ecnRecord.delete({ where: { id: ecnId } });
  revalidatePath(`/ppap/${element.ppapId}/2`);
}

export async function toggleNoEngineeringChange(ppapElementId: string, enabled: boolean, reason: string) {
  await setElementNaToggle(ppapElementId, enabled, reason, "No engineering change – initial submission");
}

export async function cloneToNewRevision(ecnId: string) {
  const ecn = await prisma.ecnRecord.findUniqueOrThrow({
    where: { id: ecnId },
    include: { ppapElement: { include: { ppap: true } } },
  });
  if (!ecn.newPartRevisionId) {
    throw new Error("This ECN hasn't been approved yet.");
  }

  const existingPpap = await prisma.ppap.findFirst({ where: { partRevisionId: ecn.newPartRevisionId } });
  if (existingPpap) {
    redirect(`/ppap/${existingPpap.id}`);
  }

  const sourcePpap = ecn.ppapElement.ppap;
  const newPpap = await prisma.ppap.create({
    data: {
      partRevisionId: ecn.newPartRevisionId,
      customerId: sourcePpap.customerId,
      level: sourcePpap.level,
      approvalMode: sourcePpap.approvalMode,
      reasonForSubmission: "Engineering change",
    },
  });
  await createPpapElements(newPpap.id, newPpap.level);

  revalidatePath("/");
  redirect(`/ppap/${newPpap.id}`);
}
