"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertSupplierUser } from "@/lib/permissions";
import { saveUploadedFile } from "@/lib/storage";

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

function revalidateCea(ppapId: string) {
  revalidatePath(`/ppap/${ppapId}/3`);
  revalidatePath(`/ppap/${ppapId}/3/print`);
  revalidatePath(`/ppap/${ppapId}`);
}

export async function saveCea(ppapElementId: string, formData: FormData) {
  const element = await assertEditable(ppapElementId);

  const requestType = str(formData, "requestType") ?? null;

  const data = {
    ceaNo: str(formData, "ceaNo") ?? null,
    ceaDate: dateOrNull(str(formData, "ceaDate")),
    requestType: requestType as never,

    existingCondition: str(formData, "existingCondition") ?? null,
    proposedChange: str(formData, "proposedChange") ?? null,
    changeReason: str(formData, "changeReason") ?? null,

    impactFitLevel: (str(formData, "impactFitLevel") ?? null) as never,
    impactFitNote: str(formData, "impactFitNote") ?? null,
    impactFormLevel: (str(formData, "impactFormLevel") ?? null) as never,
    impactFormNote: str(formData, "impactFormNote") ?? null,
    impactFunctionLevel: (str(formData, "impactFunctionLevel") ?? null) as never,
    impactFunctionNote: str(formData, "impactFunctionNote") ?? null,
    impactQualityRiskLevel: (str(formData, "impactQualityRiskLevel") ?? null) as never,
    impactQualityRiskNote: str(formData, "impactQualityRiskNote") ?? null,
    impactReliabilityLevel: (str(formData, "impactReliabilityLevel") ?? null) as never,
    impactReliabilityNote: str(formData, "impactReliabilityNote") ?? null,
    impactRegulatoryLevel: (str(formData, "impactRegulatoryLevel") ?? null) as never,
    impactRegulatoryNote: str(formData, "impactRegulatoryNote") ?? null,

    testsPerformed: str(formData, "testsPerformed") ?? null,
    testStandard: str(formData, "testStandard") ?? null,
    resultSummary: str(formData, "resultSummary") ?? null,

    submissionStatus: str(formData, "submissionStatus") ?? null,

    deviationDescription: str(formData, "deviationDescription") ?? null,
    deviationQty: str(formData, "deviationQty") ?? null,
    deviationValidityPeriod: str(formData, "deviationValidityPeriod") ?? null,
    deviationInterimContainment: str(formData, "deviationInterimContainment") ?? null,

    sampleQty: str(formData, "sampleQty") ?? null,
    sampleLotNo: str(formData, "sampleLotNo") ?? null,
    sampleSubmissionDate: dateOrNull(str(formData, "sampleSubmissionDate")),

    declaredById: str(formData, "declaredById") ?? null,
    declaredAt: dateOrNull(str(formData, "declaredAt")),
  };

  await prisma.ceaDetail.upsert({
    where: { ppapElementId },
    update: data,
    create: { ppapElementId, ...data },
  });

  revalidateCea(element.ppapId);
}

export async function uploadCeaAttachment(ppapElementId: string, formData: FormData) {
  const element = await assertEditable(ppapElementId);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("A file is required");
  }

  const saved = await saveUploadedFile(file, `ppap-elements/${ppapElementId}/cea`);
  await prisma.ceaAttachment.create({
    data: { ppapElementId, fileUrl: saved.url, fileName: saved.fileName, fileType: saved.fileType },
  });

  revalidateCea(element.ppapId);
}

export async function deleteCeaAttachment(attachmentId: string, ppapElementId: string) {
  const element = await assertEditable(ppapElementId);
  await prisma.ceaAttachment.delete({ where: { id: attachmentId } });
  revalidateCea(element.ppapId);
}
