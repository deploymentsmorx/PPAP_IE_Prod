"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
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

function revalidateSpp(ppapId: string) {
  revalidatePath(`/ppap/${ppapId}/14`);
  revalidatePath(`/ppap/${ppapId}/14/print`);
  revalidatePath(`/ppap/${ppapId}/14/tags`);
  // AAR (element 13) defaults its sample IDs from this register.
  revalidatePath(`/ppap/${ppapId}/13`);
  revalidatePath(`/ppap/${ppapId}`);
}

function str(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function dateOrNull(v: string | null): Date | null {
  return v ? new Date(v) : null;
}

const detailSchema = z.object({
  reportDate: z.string().nullable(),
  packingMethod: z.string().nullable(),
  labelling: z.string().nullable(),
  protectionMethod: z.string().nullable(),
  declaredById: z.string().nullable(),
  declaredAt: z.string().nullable(),
});

const statusSchema = z.enum(["OK", "NG"]).nullable();

/**
 * Saves the editable sections (1 date, 2 sample register, 6 functional
 * tests, 9 packaging, 10 signatory) in one go. Grid inputs are named
 * `sample-<id>-<field>` and `test-<id>-<field>`.
 */
export async function saveSpp(ppapElementId: string, formData: FormData) {
  const element = await assertEditable(ppapElementId);

  const parsed = detailSchema.parse(Object.fromEntries(Object.keys(detailSchema.shape).map((k) => [k, str(formData, k)])));
  const data = {
    reportDate: dateOrNull(parsed.reportDate),
    packingMethod: parsed.packingMethod,
    labelling: parsed.labelling,
    protectionMethod: parsed.protectionMethod,
    declaredById: parsed.declaredById,
    declaredAt: dateOrNull(parsed.declaredAt),
  };
  const before = await prisma.sppDetail.findUnique({ where: { ppapElementId } });
  const after = await prisma.sppDetail.upsert({ where: { ppapElementId }, update: data, create: { ppapElementId, ...data } });
  await audit({ ppapId: element.ppapId, action: before ? "UPDATE" : "CREATE", entityType: "SppDetail", entityId: after.id, before, after });

  const samples = await prisma.sppSample.findMany({ where: { ppapElementId } });
  const seenIds = new Set<string>();
  for (const s of samples) {
    if (formData.get(`sample-${s.id}-sampleId`) === null) continue; // added after the form rendered
    const sampleId = str(formData, `sample-${s.id}-sampleId`) ?? s.sampleId;
    if (seenIds.has(sampleId)) throw new Error(`Sample ID "${sampleId}" is used twice.`);
    seenIds.add(sampleId);
    const rowData = {
      sampleId,
      lotBatchNo: str(formData, `sample-${s.id}-lotBatchNo`),
      manufacturingDate: dateOrNull(str(formData, `sample-${s.id}-manufacturingDate`)),
      shift: str(formData, `sample-${s.id}-shift`),
      machineNo: str(formData, `sample-${s.id}-machineNo`),
      cavityNo: str(formData, `sample-${s.id}-cavityNo`),
    };
    const changed =
      rowData.sampleId !== s.sampleId ||
      rowData.lotBatchNo !== s.lotBatchNo ||
      (rowData.manufacturingDate?.getTime() ?? null) !== (s.manufacturingDate?.getTime() ?? null) ||
      rowData.shift !== s.shift ||
      rowData.machineNo !== s.machineNo ||
      rowData.cavityNo !== s.cavityNo;
    if (!changed) continue;
    const updated = await prisma.sppSample.update({ where: { id: s.id }, data: rowData });
    await audit({ ppapId: element.ppapId, action: "UPDATE", entityType: "SppSample", entityId: s.id, before: s, after: updated });
  }

  const tests = await prisma.sppFunctionalTest.findMany({ where: { ppapElementId } });
  for (const t of tests) {
    if (formData.get(`test-${t.id}-testName`) === null) continue;
    const rowData = {
      testName: str(formData, `test-${t.id}-testName`) ?? t.testName,
      specification: str(formData, `test-${t.id}-specification`),
      result: str(formData, `test-${t.id}-result`),
      status: statusSchema.parse(str(formData, `test-${t.id}-status`)),
    };
    const changed = (Object.keys(rowData) as (keyof typeof rowData)[]).some((k) => rowData[k] !== t[k]);
    if (!changed) continue;
    const updated = await prisma.sppFunctionalTest.update({ where: { id: t.id }, data: rowData });
    await audit({ ppapId: element.ppapId, action: "UPDATE", entityType: "SppFunctionalTest", entityId: t.id, before: t, after: updated });
  }

  revalidateSpp(element.ppapId);
}

/** Next free "<PROJECT>-NN" sample ID, e.g. NBL-03, matching the sheet's NBL-01 / NBL-02. */
async function nextSampleId(ppapElementId: string, ppapId: string): Promise<string> {
  const ppap = await prisma.ppap.findUniqueOrThrow({ where: { id: ppapId }, include: { partRevision: { include: { part: true } } } });
  const prefix = (ppap.partRevision.part.projectModel || "S").toUpperCase();
  const existing = new Set((await prisma.sppSample.findMany({ where: { ppapElementId }, select: { sampleId: true } })).map((s) => s.sampleId));
  for (let n = 1; ; n++) {
    const candidate = `${prefix}-${String(n).padStart(2, "0")}`;
    if (!existing.has(candidate)) return candidate;
  }
}

export async function addSppSample(ppapElementId: string) {
  const element = await assertEditable(ppapElementId);
  const count = await prisma.sppSample.count({ where: { ppapElementId } });
  const sample = await prisma.sppSample.create({
    data: { ppapElementId, sampleId: await nextSampleId(ppapElementId, element.ppapId), sortOrder: count },
  });
  await audit({ ppapId: element.ppapId, action: "CREATE", entityType: "SppSample", entityId: sample.id, before: null, after: sample });
  revalidateSpp(element.ppapId);
}

export async function deleteSppSample(sampleId: string, ppapElementId: string) {
  const element = await assertEditable(ppapElementId);
  const before = await prisma.sppSample.delete({ where: { id: sampleId } });
  await audit({ ppapId: element.ppapId, action: "DELETE", entityType: "SppSample", entityId: sampleId, before, after: null });
  revalidateSpp(element.ppapId);
}

export async function addSppFunctionalTest(ppapElementId: string) {
  const element = await assertEditable(ppapElementId);
  const count = await prisma.sppFunctionalTest.count({ where: { ppapElementId } });
  const test = await prisma.sppFunctionalTest.create({ data: { ppapElementId, testName: "New test", sortOrder: count } });
  await audit({ ppapId: element.ppapId, action: "CREATE", entityType: "SppFunctionalTest", entityId: test.id, before: null, after: test });
  revalidateSpp(element.ppapId);
}

export async function deleteSppFunctionalTest(testId: string, ppapElementId: string) {
  const element = await assertEditable(ppapElementId);
  const before = await prisma.sppFunctionalTest.delete({ where: { id: testId } });
  await audit({ ppapId: element.ppapId, action: "DELETE", entityType: "SppFunctionalTest", entityId: testId, before, after: null });
  revalidateSpp(element.ppapId);
}

export async function uploadSppPackagingPhoto(ppapElementId: string, formData: FormData) {
  const element = await assertEditable(ppapElementId);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("A photo is required");
  }
  if (file.type && !file.type.startsWith("image/")) {
    throw new Error("Packaging photos must be images.");
  }
  const saved = await saveUploadedFile(file, `ppap-elements/${ppapElementId}/spp-packaging`);
  const photo = await prisma.sppPackagingPhoto.create({
    data: { ppapElementId, fileUrl: saved.url, fileName: saved.fileName, fileType: saved.fileType },
  });
  await audit({ ppapId: element.ppapId, action: "CREATE", entityType: "SppPackagingPhoto", entityId: photo.id, before: null, after: photo });
  revalidateSpp(element.ppapId);
}

export async function deleteSppPackagingPhoto(photoId: string, ppapElementId: string) {
  const element = await assertEditable(ppapElementId);
  const before = await prisma.sppPackagingPhoto.delete({ where: { id: photoId } });
  await audit({ ppapId: element.ppapId, action: "DELETE", entityType: "SppPackagingPhoto", entityId: photoId, before, after: null });
  revalidateSpp(element.ppapId);
}
