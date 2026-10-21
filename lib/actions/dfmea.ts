"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertSupplierUser } from "@/lib/permissions";
import { isValidSod } from "@/lib/calc/fmea";

async function assertEditable(ppapElementId: string) {
  await assertSupplierUser();
  const element = await prisma.ppapElement.findUniqueOrThrow({ where: { id: ppapElementId } });
  if (element.status === "APPROVED") {
    throw new Error("This page is approved and locked. Use Revise to edit it.");
  }
  return element;
}

async function getOrCreateDfmeaDetail(ppapElementId: string) {
  const existing = await prisma.dfmeaDetail.findUnique({ where: { ppapElementId } });
  if (existing) return existing;
  return prisma.dfmeaDetail.create({ data: { ppapElementId } });
}

function revalidateDfmea(ppapId: string) {
  revalidatePath(`/ppap/${ppapId}/4`);
  revalidatePath(`/ppap/${ppapId}/4/print`);
  revalidatePath(`/ppap/${ppapId}`);
}

export async function saveDfmeaHeader(ppapElementId: string, formData: FormData) {
  const element = await assertEditable(ppapElementId);
  const detail = await getOrCreateDfmeaDetail(ppapElementId);

  const dfmeaRef = (formData.get("dfmeaRef") as string | null) || null;
  const startDateRaw = formData.get("startDate") as string | null;
  const startDate = startDateRaw ? new Date(startDateRaw) : null;
  const revision = (formData.get("revision") as string | null) || null;
  const designResponsibility = (formData.get("designResponsibility") as string | null) || null;
  const teamMemberIds = formData.getAll("teamMemberIds").map((v) => String(v));

  await prisma.dfmeaDetail.update({
    where: { id: detail.id },
    data: { dfmeaRef, startDate, revision, designResponsibility, teamMemberIds },
  });

  revalidateDfmea(element.ppapId);
}

const sodSchema = z
  .union([z.coerce.number().int().min(1).max(10), z.literal("")])
  .transform((v) => (v === "" ? null : v));

const rowSchema = z.object({
  id: z.string().optional(),
  item: z.string().optional(),
  potentialFailureMode: z.string().optional(),
  effects: z.string().optional(),
  severity: sodSchema.optional(),
  causes: z.string().optional(),
  occurrence: sodSchema.optional(),
  currentControlsPrevention: z.string().optional(),
  currentControlsDetection: z.string().optional(),
  detection: sodSchema.optional(),
  recommendedActions: z.string().optional(),
  responsibleId: z.string().optional(),
  targetDate: z.string().optional(),
  actionTaken: z.string().optional(),
  revisedSeverity: sodSchema.optional(),
  revisedOccurrence: sodSchema.optional(),
  revisedDetection: sodSchema.optional(),
});

export type DfmeaRowInput = z.input<typeof rowSchema>;

function checkSod(label: string, value: number | null | undefined) {
  if (value != null && !isValidSod(value)) {
    throw new Error(`${label} must be an integer between 1 and 10`);
  }
}

export async function upsertDfmeaRow(ppapElementId: string, input: DfmeaRowInput) {
  const element = await assertEditable(ppapElementId);
  const data = rowSchema.parse(input);

  checkSod("Severity", data.severity);
  checkSod("Occurrence", data.occurrence);
  checkSod("Detection", data.detection);
  checkSod("Revised severity", data.revisedSeverity);
  checkSod("Revised occurrence", data.revisedOccurrence);
  checkSod("Revised detection", data.revisedDetection);

  const detail = await getOrCreateDfmeaDetail(ppapElementId);

  const rowData = {
    item: data.item || null,
    potentialFailureMode: data.potentialFailureMode || null,
    effects: data.effects || null,
    severity: data.severity ?? null,
    causes: data.causes || null,
    occurrence: data.occurrence ?? null,
    currentControlsPrevention: data.currentControlsPrevention || null,
    currentControlsDetection: data.currentControlsDetection || null,
    detection: data.detection ?? null,
    recommendedActions: data.recommendedActions || null,
    responsibleId: data.responsibleId || null,
    targetDate: data.targetDate ? new Date(data.targetDate) : null,
    actionTaken: data.actionTaken || null,
    revisedSeverity: data.revisedSeverity ?? null,
    revisedOccurrence: data.revisedOccurrence ?? null,
    revisedDetection: data.revisedDetection ?? null,
  };

  if (data.id) {
    await prisma.dfmeaRow.update({ where: { id: data.id }, data: rowData });
  } else {
    const count = await prisma.dfmeaRow.count({ where: { dfmeaDetailId: detail.id } });
    await prisma.dfmeaRow.create({ data: { dfmeaDetailId: detail.id, sortOrder: count, ...rowData } });
  }

  revalidateDfmea(element.ppapId);
}

export async function deleteDfmeaRow(rowId: string, ppapElementId: string) {
  const element = await assertEditable(ppapElementId);
  await prisma.dfmeaRow.delete({ where: { id: rowId } });
  revalidateDfmea(element.ppapId);
}

export async function duplicateDfmeaRow(rowId: string, ppapElementId: string) {
  const element = await assertEditable(ppapElementId);
  const row = await prisma.dfmeaRow.findUniqueOrThrow({ where: { id: rowId } });
  const count = await prisma.dfmeaRow.count({ where: { dfmeaDetailId: row.dfmeaDetailId } });

  await prisma.dfmeaRow.create({
    data: {
      dfmeaDetailId: row.dfmeaDetailId,
      item: row.item,
      potentialFailureMode: row.potentialFailureMode,
      effects: row.effects,
      severity: row.severity,
      causes: row.causes,
      occurrence: row.occurrence,
      currentControlsPrevention: row.currentControlsPrevention,
      currentControlsDetection: row.currentControlsDetection,
      detection: row.detection,
      recommendedActions: row.recommendedActions,
      responsibleId: row.responsibleId,
      targetDate: row.targetDate,
      actionTaken: row.actionTaken,
      revisedSeverity: row.revisedSeverity,
      revisedOccurrence: row.revisedOccurrence,
      revisedDetection: row.revisedDetection,
      sortOrder: count,
    },
  });

  revalidateDfmea(element.ppapId);
}
