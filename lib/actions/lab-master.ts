"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertSupplierUser } from "@/lib/permissions";
import { saveUploadedFile } from "@/lib/storage";

async function requireUserId() {
  return (await assertSupplierUser()).id;
}

async function audit(params: { userId: string; action: "CREATE" | "UPDATE" | "DELETE"; entityId: string; before: unknown; after: unknown }) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      entityType: "LabMaster",
      entityId: params.entityId,
      before: params.before as never,
      after: params.after as never,
    },
  });
}

function revalidateLabMasters() {
  revalidatePath("/labs");
  // Every PPAP's element 12 picker lists the labs.
  revalidatePath("/(app)/ppap/[id]/[element]", "page");
}

function str(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

const labMasterSchema = z.object({
  name: z.string().min(1, "Lab name is required"),
  accreditationBody: z.string().optional(),
  certificateNo: z.string().optional(),
  scope: z.string().optional(),
  validUntil: z.string().optional(),
});

/**
 * Reads the form fields plus an optional certificate PDF. A missing file on
 * update keeps the PDF already on record — only a new upload replaces it.
 */
async function labMasterDataFromForm(formData: FormData) {
  const data = labMasterSchema.parse({
    name: str(formData, "name"),
    accreditationBody: str(formData, "accreditationBody"),
    certificateNo: str(formData, "certificateNo"),
    scope: str(formData, "scope"),
    validUntil: str(formData, "validUntil"),
  });

  const fields = {
    name: data.name,
    accreditationBody: data.accreditationBody ?? null,
    certificateNo: data.certificateNo ?? null,
    scope: data.scope ?? null,
    validUntil: data.validUntil ? new Date(data.validUntil) : null,
  };

  const file = formData.get("certificatePdf");
  if (file instanceof File && file.size > 0) {
    if (file.type && file.type !== "application/pdf") {
      throw new Error("The accreditation certificate must be a PDF.");
    }
    const saved = await saveUploadedFile(file, "lab-masters");
    return { ...fields, certificatePdfUrl: saved.url, certificatePdfName: saved.fileName, certificatePdfType: saved.fileType };
  }
  return fields;
}

export async function createLabMaster(formData: FormData) {
  const userId = await requireUserId();
  const data = await labMasterDataFromForm(formData);
  const lab = await prisma.labMaster.create({ data });
  await audit({ userId, action: "CREATE", entityId: lab.id, before: null, after: lab });
  revalidateLabMasters();
  return { id: lab.id };
}

export async function updateLabMaster(labId: string, formData: FormData) {
  const userId = await requireUserId();
  const before = await prisma.labMaster.findUniqueOrThrow({ where: { id: labId } });
  const data = await labMasterDataFromForm(formData);
  const after = await prisma.labMaster.update({ where: { id: labId }, data });
  await audit({ userId, action: "UPDATE", entityId: labId, before, after });
  revalidateLabMasters();
}

/**
 * Only a lab no report has used can be deleted — an expired lab that
 * reports already reference must stay so those reports keep their lab
 * name; its expiry alone already blocks it from new reports.
 */
export async function deleteLabMaster(labId: string) {
  const userId = await requireUserId();
  const used = await prisma.labReport.count({ where: { labId } });
  if (used > 0) {
    throw new Error(`This lab is used by ${used} lab report(s) and cannot be deleted.`);
  }
  const before = await prisma.labMaster.findUniqueOrThrow({ where: { id: labId } });
  await prisma.labMaster.delete({ where: { id: labId } });
  await audit({ userId, action: "DELETE", entityId: labId, before, after: null });
  revalidateLabMasters();
}
