"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { assertSupplierUser } from "@/lib/permissions";
import { syncProcessStepsFromPfc, importPfmeaWorkbook } from "@/lib/pfmea-import";
import { sendMail } from "@/lib/mail";
import { formatDateIndia } from "@/lib/format";

async function assertEditable(ppapElementId: string) {
  await assertSupplierUser();
  const element = await prisma.ppapElement.findUniqueOrThrow({ where: { id: ppapElementId } });
  if (element.status === "APPROVED") {
    throw new Error("This page is approved and locked. Use Revise to edit it.");
  }
  return element;
}

function revalidatePfmea(ppapId: string) {
  revalidatePath(`/ppap/${ppapId}/6`);
  revalidatePath(`/ppap/${ppapId}/6/print`);
  revalidatePath(`/ppap/${ppapId}`);
}

export async function syncFromPfc(ppapElementId: string) {
  const element = await assertEditable(ppapElementId);
  const result = await syncProcessStepsFromPfc(ppapElementId);
  revalidatePfmea(element.ppapId);
  return result;
}

export async function addProcessStep(ppapElementId: string, name: string) {
  const element = await assertEditable(ppapElementId);
  const maxSortOrder = await prisma.pfmeaProcessStep.aggregate({
    where: { ppapElementId },
    _max: { sortOrder: true },
  });
  const step = await prisma.pfmeaProcessStep.create({
    data: { ppapElementId, name, sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1 },
  });
  revalidatePfmea(element.ppapId);
  return step;
}

export async function deleteProcessStep(stepId: string, ppapElementId: string) {
  const element = await assertEditable(ppapElementId);
  const rowCount = await prisma.pfmeaRow.count({ where: { pfmeaProcessStepId: stepId } });
  if (rowCount > 0) {
    throw new Error("Cannot delete a process step that still has failure-mode rows. Delete those first.");
  }
  await prisma.pfmeaProcessStep.delete({ where: { id: stepId } });
  revalidatePfmea(element.ppapId);
}

const rowSchema = z.object({
  id: z.string().optional(),
  pfmeaProcessStepId: z.string(),
  processFunction: z.string().optional(),
  potentialFailureMode: z.string().optional(),
  potentialEffect: z.string().optional(),
  severity: z.string().optional(),
  potentialCause: z.string().optional(),
  occurrence: z.string().optional(),
  currentPreventionControls: z.string().optional(),
  currentDetectionControls: z.string().optional(),
  detection: z.string().optional(),
  recommendedActions: z.string().optional(),
  responsibleId: z.string().optional(),
  responsibleText: z.string().optional(),
  targetDate: z.string().optional(),
  actionTaken: z.string().optional(),
  revisedSeverity: z.string().optional(),
  revisedOccurrence: z.string().optional(),
  revisedDetection: z.string().optional(),
  revisionNo: z.string().optional(),
  revisionDate: z.string().optional(),
});
export type PfmeaRowInput = z.input<typeof rowSchema>;

function toInt(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

function toDate(v: string | undefined): Date | null {
  return v ? new Date(v) : null;
}

export async function upsertPfmeaRow(ppapElementId: string, input: PfmeaRowInput) {
  const element = await assertEditable(ppapElementId);
  const data = rowSchema.parse(input);

  for (const [label, v] of [
    ["Severity", data.severity],
    ["Occurrence", data.occurrence],
    ["Detection", data.detection],
    ["Revised severity", data.revisedSeverity],
    ["Revised occurrence", data.revisedOccurrence],
    ["Revised detection", data.revisedDetection],
  ] as const) {
    if (v) {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 10) {
        throw new Error(`${label} must be an integer between 1 and 10`);
      }
    }
  }

  const rowData = {
    pfmeaProcessStepId: data.pfmeaProcessStepId,
    processFunction: data.processFunction || null,
    potentialFailureMode: data.potentialFailureMode || null,
    potentialEffect: data.potentialEffect || null,
    severity: toInt(data.severity),
    potentialCause: data.potentialCause || null,
    occurrence: toInt(data.occurrence),
    currentPreventionControls: data.currentPreventionControls || null,
    currentDetectionControls: data.currentDetectionControls || null,
    detection: toInt(data.detection),
    recommendedActions: data.recommendedActions || null,
    responsibleId: data.responsibleId || null,
    responsibleText: data.responsibleText || null,
    targetDate: toDate(data.targetDate),
    actionTaken: data.actionTaken || null,
    revisedSeverity: toInt(data.revisedSeverity),
    revisedOccurrence: toInt(data.revisedOccurrence),
    revisedDetection: toInt(data.revisedDetection),
    revisionNo: data.revisionNo || null,
    revisionDate: toDate(data.revisionDate),
  };

  if (data.id) {
    await prisma.pfmeaRow.update({ where: { id: data.id }, data: rowData });
  } else {
    const count = await prisma.pfmeaRow.count({ where: { pfmeaProcessStepId: data.pfmeaProcessStepId } });
    await prisma.pfmeaRow.create({ data: { ...rowData, sortOrder: count } });
  }

  revalidatePfmea(element.ppapId);
}

export async function deletePfmeaRow(rowId: string, ppapElementId: string) {
  const element = await assertEditable(ppapElementId);
  await prisma.pfmeaRow.delete({ where: { id: rowId } });
  revalidatePfmea(element.ppapId);
}

// ---------------------------------------------------------------------------
// Failure-mode library
// ---------------------------------------------------------------------------

export async function saveRowAsTemplate(rowId: string, operationId: string) {
  const row = await prisma.pfmeaRow.findUniqueOrThrow({ where: { id: rowId } });
  await prisma.pfmeaFailureModeTemplate.create({
    data: {
      operationId,
      processFunction: row.processFunction,
      potentialFailureMode: row.potentialFailureMode,
      potentialEffect: row.potentialEffect,
      severity: row.severity,
      potentialCause: row.potentialCause,
      occurrence: row.occurrence,
      currentPreventionControls: row.currentPreventionControls,
      currentDetectionControls: row.currentDetectionControls,
      detection: row.detection,
      recommendedActions: row.recommendedActions,
    },
  });
}

export async function insertFromLibrary(ppapElementId: string, pfmeaProcessStepId: string, templateId: string) {
  const element = await assertEditable(ppapElementId);
  const template = await prisma.pfmeaFailureModeTemplate.findUniqueOrThrow({ where: { id: templateId } });
  const count = await prisma.pfmeaRow.count({ where: { pfmeaProcessStepId } });

  await prisma.pfmeaRow.create({
    data: {
      pfmeaProcessStepId,
      processFunction: template.processFunction,
      potentialFailureMode: template.potentialFailureMode,
      potentialEffect: template.potentialEffect,
      severity: template.severity,
      potentialCause: template.potentialCause,
      occurrence: template.occurrence,
      currentPreventionControls: template.currentPreventionControls,
      currentDetectionControls: template.currentDetectionControls,
      detection: template.detection,
      recommendedActions: template.recommendedActions,
      sortOrder: count,
    },
  });

  revalidatePfmea(element.ppapId);
}

export async function getFailureModeTemplates(operationCode: string | null) {
  if (!operationCode) return [];
  const operation = await prisma.operation.findUnique({ where: { code: operationCode } });
  if (!operation) return [];
  return prisma.pfmeaFailureModeTemplate.findMany({
    where: { operationId: operation.id },
    orderBy: { createdAt: "desc" },
  });
}

export async function getOperationsForLibrary() {
  return prisma.operation.findMany({ orderBy: { sortOrder: "asc" } });
}

// ---------------------------------------------------------------------------
// Excel import
// ---------------------------------------------------------------------------

export async function importPfmeaExcel(ppapElementId: string, formData: FormData) {
  const element = await assertEditable(ppapElementId);

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    throw new Error("Select a file to import.");
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const result = await importPfmeaWorkbook(workbook, ppapElementId);
  revalidatePfmea(element.ppapId);
  return result;
}

// ---------------------------------------------------------------------------
// Action reminder emails (manual trigger)
// ---------------------------------------------------------------------------

export async function sendActionReminders(ppapElementId: string) {
  const steps = await prisma.pfmeaProcessStep.findMany({
    where: { ppapElementId },
    include: { rows: { include: { responsible: true } } },
  });

  const openByUser = new Map<string, { email: string; name: string; items: string[] }>();
  let skippedNoEmail = 0;

  for (const step of steps) {
    for (const row of step.rows) {
      const isOpen = row.recommendedActions && !row.actionTaken;
      if (!isOpen) continue;

      if (!row.responsible?.email) {
        skippedNoEmail++;
        continue;
      }

      const dateLabel = row.targetDate ? formatDateIndia(row.targetDate) : "no target date set";
      const overdue = row.targetDate && row.targetDate < new Date() ? " (OVERDUE)" : "";
      const line = `- [${step.name}] ${row.potentialFailureMode ?? "(no failure mode)"} — ${row.recommendedActions} — due ${dateLabel}${overdue}`;

      const existing = openByUser.get(row.responsible.id);
      if (existing) {
        existing.items.push(line);
      } else {
        openByUser.set(row.responsible.id, { email: row.responsible.email, name: row.responsible.name, items: [line] });
      }
    }
  }

  let emailsSent = 0;
  for (const { email, name, items } of openByUser.values()) {
    const text = `Hi ${name},\n\nYou have ${items.length} open PFMEA action(s):\n\n${items.join("\n")}\n\nPlease update the PFMEA sheet once action is taken.`;
    await sendMail(email, `PFMEA: ${items.length} open action(s) assigned to you`, text);
    emailsSent++;
  }

  return { emailsSent, recipientsSkippedNoEmail: skippedNoEmail };
}
