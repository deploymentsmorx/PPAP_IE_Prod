"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { assertSupplierUser } from "@/lib/permissions";
import { saveUploadedFile } from "@/lib/storage";
import { nextMasterSampleId } from "@/lib/calc/master-sample";

async function assertEditable(ppapElementId: string) {
  await assertSupplierUser();
  const element = await prisma.ppapElement.findUniqueOrThrow({ where: { id: ppapElementId } });
  if (element.status === "APPROVED") {
    throw new Error("This page is approved and locked. Use Revise to edit it.");
  }
  return element;
}

async function audit(params: {
  ppapId: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }
  await prisma.auditLog.create({
    data: {
      ppapId: params.ppapId,
      userId: session.user.id,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      before: params.before as never,
      after: params.after as never,
    },
  });
}

function revalidateMasterSample(ppapId: string) {
  revalidatePath(`/ppap/${ppapId}/15`);
  revalidatePath(`/ppap/${ppapId}/15/print`);
  revalidatePath(`/ppap/${ppapId}/15/tags`);
  revalidatePath(`/ppap/${ppapId}`);
  revalidatePath("/"); // dashboard expiry reminders
}

function str(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

const rowSchema = z.object({
  sampleId: z.string().min(1, "Sample ID is required"),
  approvalDate: z.string().nullable(),
  storageLocation: z.string().nullable(),
  // Not z.coerce: that turns an empty cell (null) into 0 years.
  retentionYears: z.preprocess((v) => (v == null ? null : Number(v)), z.number().int().min(0).max(100).nullable()),
  status: z.enum(["ACTIVE", "SUPERSEDED", "DISPOSED"]),
  remarks: z.string().nullable(),
});

/** Saves every register row; inputs are named `ms-<id>-<field>`. */
export async function saveMasterSamples(ppapElementId: string, formData: FormData) {
  const element = await assertEditable(ppapElementId);
  const rows = await prisma.masterSample.findMany({ where: { ppapElementId } });
  const seen = new Set<string>();

  for (const row of rows) {
    if (formData.get(`ms-${row.id}-sampleId`) === null) continue; // added after the form rendered
    const parsed = rowSchema.parse({
      sampleId: str(formData, `ms-${row.id}-sampleId`) ?? row.sampleId,
      approvalDate: str(formData, `ms-${row.id}-approvalDate`),
      storageLocation: str(formData, `ms-${row.id}-storageLocation`),
      retentionYears: str(formData, `ms-${row.id}-retentionYears`),
      status: str(formData, `ms-${row.id}-status`) ?? row.status,
      remarks: str(formData, `ms-${row.id}-remarks`),
    });
    if (seen.has(parsed.sampleId)) throw new Error(`Sample ID "${parsed.sampleId}" is used twice.`);
    seen.add(parsed.sampleId);

    const data = {
      sampleId: parsed.sampleId,
      approvalDate: parsed.approvalDate ? new Date(parsed.approvalDate) : null,
      storageLocation: parsed.storageLocation,
      retentionYears: parsed.retentionYears,
      status: parsed.status,
      remarks: parsed.remarks,
      // Manually setting a row back to ACTIVE clears the auto-supersede marker.
      ...(parsed.status === "ACTIVE" ? { supersededAt: null, supersededByPpapId: null } : {}),
    };
    const changed =
      data.sampleId !== row.sampleId ||
      (data.approvalDate?.getTime() ?? null) !== (row.approvalDate?.getTime() ?? null) ||
      data.storageLocation !== row.storageLocation ||
      data.retentionYears !== row.retentionYears ||
      data.status !== row.status ||
      data.remarks !== row.remarks;
    if (!changed) continue;

    const after = await prisma.masterSample.update({ where: { id: row.id }, data });
    await audit({ ppapId: element.ppapId, action: "UPDATE", entityType: "MasterSample", entityId: row.id, before: row, after });
  }
  revalidateMasterSample(element.ppapId);
}

export async function addMasterSample(ppapElementId: string) {
  const element = await assertEditable(ppapElementId);
  const ppap = await prisma.ppap.findUniqueOrThrow({ where: { id: element.ppapId }, include: { partRevision: { include: { part: true } } } });
  const existing = await prisma.masterSample.findMany({ where: { ppapElementId }, select: { sampleId: true } });
  const prefix = (ppap.partRevision.part.projectModel || "MS").toUpperCase();
  const row = await prisma.masterSample.create({
    data: {
      ppapElementId,
      sampleId: nextMasterSampleId(prefix, existing.map((e) => e.sampleId)),
      // The reference sheet's retention period for this customer.
      retentionYears: 3,
      sortOrder: existing.length,
    },
  });
  await audit({ ppapId: element.ppapId, action: "CREATE", entityType: "MasterSample", entityId: row.id, before: null, after: row });
  revalidateMasterSample(element.ppapId);
}

export async function deleteMasterSample(masterSampleId: string, ppapElementId: string) {
  const element = await assertEditable(ppapElementId);
  const before = await prisma.masterSample.findUniqueOrThrow({ where: { id: masterSampleId }, include: { images: true } });
  await prisma.masterSampleImage.deleteMany({ where: { masterSampleId } });
  await prisma.masterSample.delete({ where: { id: masterSampleId } });
  await audit({ ppapId: element.ppapId, action: "DELETE", entityType: "MasterSample", entityId: masterSampleId, before, after: null });
  revalidateMasterSample(element.ppapId);
}

export async function uploadMasterSampleImage(masterSampleId: string, ppapElementId: string, formData: FormData) {
  const element = await assertEditable(ppapElementId);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("A photo is required");
  }
  if (file.type && !file.type.startsWith("image/")) {
    throw new Error("Master sample photos must be images.");
  }
  const saved = await saveUploadedFile(file, `ppap-elements/${ppapElementId}/master-sample`);
  const image = await prisma.masterSampleImage.create({
    data: { masterSampleId, fileUrl: saved.url, fileName: saved.fileName, fileType: saved.fileType },
  });
  await audit({ ppapId: element.ppapId, action: "CREATE", entityType: "MasterSampleImage", entityId: image.id, before: null, after: image });
  revalidateMasterSample(element.ppapId);
}

export async function deleteMasterSampleImage(imageId: string, ppapElementId: string) {
  const element = await assertEditable(ppapElementId);
  const before = await prisma.masterSampleImage.delete({ where: { id: imageId } });
  await audit({ ppapId: element.ppapId, action: "DELETE", entityType: "MasterSampleImage", entityId: imageId, before, after: null });
  revalidateMasterSample(element.ppapId);
}
