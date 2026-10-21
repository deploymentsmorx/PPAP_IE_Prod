"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { assertSupplierUser } from "@/lib/permissions";
import { saveUploadedFile } from "@/lib/storage";
import { getLabPaintResultsForPpap } from "@/lib/aar";
import { getAarCriteriaForPpap } from "@/lib/csr";

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

function revalidateAar(ppapId: string) {
  revalidatePath(`/ppap/${ppapId}/13`);
  revalidatePath(`/ppap/${ppapId}/13/print`);
  revalidatePath(`/ppap/${ppapId}`);
}

function str(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

function dateOrNull(v: string | undefined): Date | null {
  return v ? new Date(v) : null;
}

const detailSchema = z.object({
  reportDate: z.string().optional(),
  submissionReason: z.enum(["NEW_PART", "ENGINEERING_CHANGE", "TOOLING_CHANGE", "SUPPLIER_CHANGE", "OTHER"]).optional(),
  submissionReasonOther: z.string().optional(),
  sampleSize: z.string().optional(),
  samplesEvaluated: z.string().optional(),
  sampleIds: z.string().optional(),
  productionCondition: z.enum(["PROTOTYPE", "TRIAL_RUN", "MASS_PRODUCTION"]).optional(),
  masterSampleNo: z.string().optional(),
  masterSampleApprovedBy: z.string().optional(),
  masterSampleApprovalDate: z.string().optional(),
  masterSampleLocation: z.string().optional(),
  overallResult: z.enum(["APPROVED", "CONDITIONALLY_APPROVED", "REJECTED"]).optional(),
  deviationDetails: z.string().optional(),
  correctiveActionPlan: z.string().optional(),
});

const ROW_FIELDS = ["parameter", "specification", "evaluationMethod", "acceptanceCriteria", "result"] as const;

/**
 * Saves sections 1, 3, 4, 5 and every criteria row's text in one go (the
 * page is one form, like the sheet). Row inputs are named
 * `row-<id>-<field>`.
 */
export async function saveAar(ppapElementId: string, formData: FormData) {
  const element = await assertEditable(ppapElementId);

  const parsed = detailSchema.parse(Object.fromEntries(Object.keys(detailSchema.shape).map((k) => [k, str(formData, k)])));
  const data = {
    reportDate: dateOrNull(parsed.reportDate),
    submissionReason: parsed.submissionReason ?? null,
    submissionReasonOther: parsed.submissionReason === "OTHER" ? (parsed.submissionReasonOther ?? null) : null,
    sampleSize: parsed.sampleSize ?? null,
    samplesEvaluated: parsed.samplesEvaluated ?? null,
    sampleIds: parsed.sampleIds ?? null,
    productionCondition: parsed.productionCondition ?? null,
    masterSampleNo: parsed.masterSampleNo ?? null,
    masterSampleApprovedBy: parsed.masterSampleApprovedBy ?? null,
    masterSampleApprovalDate: dateOrNull(parsed.masterSampleApprovalDate),
    masterSampleLocation: parsed.masterSampleLocation ?? null,
    overallResult: parsed.overallResult ?? null,
    deviationDetails: parsed.deviationDetails ?? null,
    correctiveActionPlan: parsed.correctiveActionPlan ?? null,
  };

  const before = await prisma.aarDetail.findUnique({ where: { ppapElementId } });
  const after = await prisma.aarDetail.upsert({
    where: { ppapElementId },
    update: data,
    create: { ppapElementId, ...data },
  });
  await audit({ ppapId: element.ppapId, action: before ? "UPDATE" : "CREATE", entityType: "AarDetail", entityId: after.id, before, after });

  const rows = await prisma.aarCriteriaRow.findMany({ where: { ppapElementId } });
  for (const row of rows) {
    if (formData.get(`row-${row.id}-parameter`) === null) continue; // row added after the form was rendered
    const rowData = Object.fromEntries(ROW_FIELDS.map((f) => [f, str(formData, `row-${row.id}-${f}`) ?? null])) as Record<
      (typeof ROW_FIELDS)[number],
      string | null
    >;
    rowData.parameter = rowData.parameter ?? row.parameter;
    const changed = ROW_FIELDS.some((f) => rowData[f] !== row[f]);
    if (!changed) continue;
    const updated = await prisma.aarCriteriaRow.update({ where: { id: row.id }, data: { ...rowData, parameter: rowData.parameter! } });
    await audit({ ppapId: element.ppapId, action: "UPDATE", entityType: "AarCriteriaRow", entityId: row.id, before: row, after: updated });
  }

  revalidateAar(element.ppapId);
}

export async function addAarCriteriaRow(ppapElementId: string) {
  const element = await assertEditable(ppapElementId);
  const count = await prisma.aarCriteriaRow.count({ where: { ppapElementId } });
  const row = await prisma.aarCriteriaRow.create({ data: { ppapElementId, sortOrder: count, parameter: "New parameter" } });
  await audit({ ppapId: element.ppapId, action: "CREATE", entityType: "AarCriteriaRow", entityId: row.id, before: null, after: row });
  revalidateAar(element.ppapId);
}

export async function deleteAarCriteriaRow(rowId: string, ppapElementId: string) {
  const element = await assertEditable(ppapElementId);
  const before = await prisma.aarCriteriaRow.findUniqueOrThrow({ where: { id: rowId }, include: { photos: true } });
  await prisma.aarPhoto.deleteMany({ where: { aarCriteriaRowId: rowId } });
  await prisma.aarCriteriaRow.delete({ where: { id: rowId } });
  await audit({ ppapId: element.ppapId, action: "DELETE", entityType: "AarCriteriaRow", entityId: rowId, before, after: null });
  revalidateAar(element.ppapId);
}

/** Re-pulls DFT / adhesion / gloss results from the latest Lab Reports (element 12). */
export async function pullAarLabResults(ppapElementId: string): Promise<{ updated: number }> {
  const element = await assertEditable(ppapElementId);
  const lab = await getLabPaintResultsForPpap(element.ppapId);
  const rows = await prisma.aarCriteriaRow.findMany({ where: { ppapElementId, labPaintProperty: { not: null } } });
  let updated = 0;
  for (const row of rows) {
    const result = row.labPaintProperty && row.labPaintProperty !== "VISUAL" ? lab[row.labPaintProperty] : undefined;
    if (!result || result === row.result) continue;
    const after = await prisma.aarCriteriaRow.update({ where: { id: row.id }, data: { result } });
    await audit({ ppapId: element.ppapId, action: "UPDATE", entityType: "AarCriteriaRow", entityId: row.id, before: row, after });
    updated++;
  }
  revalidateAar(element.ppapId);
  return { updated };
}

/**
 * Re-applies the customer's CSR zone A criteria (element 17) to the
 * matching AAR rows — acceptance criteria and evaluation method only.
 */
export async function applyAarCsrCriteria(ppapElementId: string): Promise<{ updated: number }> {
  const element = await assertEditable(ppapElementId);
  const csr = await getAarCriteriaForPpap(element.ppapId);
  const rows = await prisma.aarCriteriaRow.findMany({ where: { ppapElementId } });
  let updated = 0;
  for (const row of rows) {
    const c = csr[row.parameter];
    if (!c) continue;
    const data = {
      acceptanceCriteria: c.acceptanceCriteria ?? row.acceptanceCriteria,
      evaluationMethod: c.evaluationMethod ?? row.evaluationMethod,
    };
    if (data.acceptanceCriteria === row.acceptanceCriteria && data.evaluationMethod === row.evaluationMethod) continue;
    const after = await prisma.aarCriteriaRow.update({ where: { id: row.id }, data });
    await audit({ ppapId: element.ppapId, action: "UPDATE", entityType: "AarCriteriaRow", entityId: row.id, before: row, after });
    updated++;
  }
  revalidateAar(element.ppapId);
  return { updated };
}

export async function uploadAarPhoto(rowId: string, ppapElementId: string, formData: FormData) {
  const element = await assertEditable(ppapElementId);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("A photo is required");
  }
  if (file.type && !file.type.startsWith("image/")) {
    throw new Error("Photo evidence must be an image.");
  }
  const saved = await saveUploadedFile(file, `ppap-elements/${ppapElementId}/aar`);
  const photo = await prisma.aarPhoto.create({
    data: { aarCriteriaRowId: rowId, fileUrl: saved.url, fileName: saved.fileName, fileType: saved.fileType },
  });
  await audit({ ppapId: element.ppapId, action: "CREATE", entityType: "AarPhoto", entityId: photo.id, before: null, after: photo });
  revalidateAar(element.ppapId);
}

export async function deleteAarPhoto(photoId: string, ppapElementId: string) {
  const element = await assertEditable(ppapElementId);
  const before = await prisma.aarPhoto.delete({ where: { id: photoId } });
  await audit({ ppapId: element.ppapId, action: "DELETE", entityType: "AarPhoto", entityId: photoId, before, after: null });
  revalidateAar(element.ppapId);
}
