"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertSupplierUser } from "@/lib/permissions";
import { generateFromPfcPfmea } from "@/lib/control-plan-sync";
import { isInstrumentPickable } from "@/lib/calc/calibration";
import { assertInstrumentPickable } from "@/lib/instruments";

async function assertEditable(ppapElementId: string) {
  await assertSupplierUser();
  const element = await prisma.ppapElement.findUniqueOrThrow({ where: { id: ppapElementId } });
  if (element.status === "APPROVED") {
    throw new Error("This page is approved and locked. Use Revise to edit it.");
  }
  return element;
}

function revalidateControlPlan(ppapId: string) {
  revalidatePath(`/ppap/${ppapId}/7`);
  revalidatePath(`/ppap/${ppapId}/7/print`);
  revalidatePath(`/ppap/${ppapId}`);
}

function str(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

function dateOrNull(v: string | undefined): Date | null {
  return v ? new Date(v) : null;
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

export async function saveControlPlanHeader(ppapElementId: string, formData: FormData) {
  const element = await assertEditable(ppapElementId);

  const data = {
    phasePrototype: formData.get("phasePrototype") === "on",
    phasePreLaunch: formData.get("phasePreLaunch") === "on",
    phaseProduction: formData.get("phaseProduction") === "on",

    controlPlanNo: str(formData, "controlPlanNo") ?? null,
    revisionNo: str(formData, "revisionNo") ?? null,
    dateOrig: dateOrNull(str(formData, "dateOrig")),
    dateRev: dateOrNull(str(formData, "dateRev")),

    partDescription: str(formData, "partDescription") ?? null,
    customerPartNo: str(formData, "customerPartNo") ?? null,
    customerPartRevision: str(formData, "customerPartRevision") ?? null,
    partNo: str(formData, "partNo") ?? null,
    partRevision: str(formData, "partRevision") ?? null,
    supplier: str(formData, "supplier") ?? null,
    plant: str(formData, "plant") ?? null,
    material: str(formData, "material") ?? null,
    keyContactPhone: str(formData, "keyContactPhone") ?? null,
    coreTeamText: str(formData, "coreTeamText") ?? null,

    supplierPlantApprovalDate: dateOrNull(str(formData, "supplierPlantApprovalDate")),
    customerEngineeringApprovalDate: dateOrNull(str(formData, "customerEngineeringApprovalDate")),
    customerQualityApprovalDate: dateOrNull(str(formData, "customerQualityApprovalDate")),
  };

  await prisma.controlPlanDetail.upsert({
    where: { ppapElementId },
    update: data,
    create: { ppapElementId, ...data },
  });

  revalidateControlPlan(element.ppapId);
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

const rowSchema = z.object({
  id: z.string().optional(),
  processNameOperation: z.string().optional(),
  machineDeviceJigTools: z.string().optional(),
  stageNo: z.string().optional(),
  productCharacteristic: z.string().optional(),
  processCharacteristic: z.string().optional(),
  specialCharacteristicId: z.string().optional(),
  productProcessSpecification: z.string().optional(),
  evaluationMeasurementTechnique: z.string().optional(),
  instrumentId: z.string().optional(),
  leastCountText: z.string().optional(),
  controlInCharge: z.string().optional(),
  sampleSize: z.string().optional(),
  sampleFrequency: z.string().optional(),
  recordingRequired: z.string().optional(),
  controlMethod: z.string().optional(),
  reactionPlan: z.string().optional(),
});
export type ControlPlanRowInput = z.input<typeof rowSchema>;

function toInt(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

function toBool(v: string | undefined): boolean | null {
  if (v === undefined || v === "") return null;
  return v === "true" || v === "on" || v === "Yes" || v === "yes";
}

async function getOrCreateDetail(ppapElementId: string) {
  const existing = await prisma.controlPlanDetail.findUnique({ where: { ppapElementId } });
  if (existing) return existing;
  return prisma.controlPlanDetail.create({ data: { ppapElementId } });
}

export async function upsertControlPlanRow(ppapElementId: string, input: ControlPlanRowInput) {
  const element = await assertEditable(ppapElementId);
  const data = rowSchema.parse(input);

  const previous = data.id ? await prisma.controlPlanRow.findUnique({ where: { id: data.id }, select: { instrumentId: true } }) : null;
  await assertInstrumentPickable(data.instrumentId, previous?.instrumentId);

  const rowData = {
    processNameOperation: data.processNameOperation || null,
    machineDeviceJigTools: data.machineDeviceJigTools || null,
    stageNo: toInt(data.stageNo),
    productCharacteristic: data.productCharacteristic || null,
    processCharacteristic: data.processCharacteristic || null,
    specialCharacteristicId: data.specialCharacteristicId || null,
    productProcessSpecification: data.productProcessSpecification || null,
    evaluationMeasurementTechnique: data.evaluationMeasurementTechnique || null,
    instrumentId: data.instrumentId || null,
    leastCountText: data.leastCountText || null,
    controlInCharge: data.controlInCharge || null,
    sampleSize: data.sampleSize || null,
    sampleFrequency: data.sampleFrequency || null,
    recordingRequired: toBool(data.recordingRequired),
    controlMethod: data.controlMethod || null,
    reactionPlan: data.reactionPlan || null,
  };

  if (data.id) {
    await prisma.controlPlanRow.update({ where: { id: data.id }, data: rowData });
  } else {
    const detail = await getOrCreateDetail(ppapElementId);
    const count = await prisma.controlPlanRow.count({ where: { controlPlanDetailId: detail.id } });
    await prisma.controlPlanRow.create({ data: { ...rowData, controlPlanDetailId: detail.id, sortOrder: count } });
  }

  revalidateControlPlan(element.ppapId);
}

export async function deleteControlPlanRow(rowId: string, ppapElementId: string) {
  const element = await assertEditable(ppapElementId);
  await prisma.controlPlanRow.delete({ where: { id: rowId } });
  revalidateControlPlan(element.ppapId);
}

export async function moveControlPlanRow(rowId: string, ppapElementId: string, direction: "up" | "down") {
  const element = await assertEditable(ppapElementId);

  const row = await prisma.controlPlanRow.findUniqueOrThrow({ where: { id: rowId } });
  const all = await prisma.controlPlanRow.findMany({
    where: { controlPlanDetailId: row.controlPlanDetailId },
    orderBy: { sortOrder: "asc" },
  });
  const index = all.findIndex((r) => r.id === rowId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= all.length) return;

  const a = all[index];
  const b = all[swapIndex];
  await prisma.$transaction([
    prisma.controlPlanRow.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
    prisma.controlPlanRow.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
  ]);

  revalidateControlPlan(element.ppapId);
}

// ---------------------------------------------------------------------------
// Generate from PFC/PFMEA
// ---------------------------------------------------------------------------

export async function generateFromPfc(ppapElementId: string) {
  const element = await assertEditable(ppapElementId);
  const result = await generateFromPfcPfmea(ppapElementId);
  revalidateControlPlan(element.ppapId);
  return result;
}

// ---------------------------------------------------------------------------
// Pickers
// ---------------------------------------------------------------------------

export async function getInstrumentsForPicker() {
  const instruments = await prisma.instrument.findMany({ orderBy: { slNo: "asc" } });
  return instruments.map((i) => ({
    ...i,
    pickable: isInstrumentPickable(i.calibrationDue),
  }));
}

export async function getSpecialCharacteristicsForPicker(ppapId: string) {
  const designRecordElement = await prisma.ppapElement.findUnique({
    where: { ppapId_elementNo: { ppapId, elementNo: 1 } },
  });
  if (!designRecordElement) return [];
  return prisma.specialCharacteristic.findMany({
    where: { ppapElementId: designRecordElement.id },
    orderBy: { sortOrder: "asc" },
  });
}

// ---------------------------------------------------------------------------
// Consistency checks
// ---------------------------------------------------------------------------

export async function getControlPlanConsistencyChecks(ppapElementId: string) {
  const element = await prisma.ppapElement.findUniqueOrThrow({ where: { id: ppapElementId } });

  const [detail, pfmeaElement] = await Promise.all([
    prisma.controlPlanDetail.findUnique({
      where: { ppapElementId },
      include: { rows: { include: { instrument: true } } },
    }),
    prisma.ppapElement.findUnique({ where: { ppapId_elementNo: { ppapId: element.ppapId, elementNo: 6 } } }),
  ]);

  const rows = detail?.rows ?? [];

  const rowsWithoutReactionPlan = rows.filter((r) => !r.reactionPlan).map((r) => r.processNameOperation ?? "(unnamed)");

  const overdueInstruments = rows
    .filter((r) => r.instrument && !isInstrumentPickable(r.instrument.calibrationDue))
    .map((r) => r.instrument!.description);

  let missingPfmeaControls: string[] = [];
  if (pfmeaElement) {
    const pfmeaSteps = await prisma.pfmeaProcessStep.findMany({
      where: { ppapElementId: pfmeaElement.id, removedFromSource: false },
      include: { rows: true },
    });
    const controlledStepNames = new Set(rows.map((r) => r.processNameOperation).filter((s): s is string => !!s));
    missingPfmeaControls = pfmeaSteps
      .filter((step) => step.rows.some((r) => r.currentDetectionControls))
      .filter((step) => !controlledStepNames.has(step.name))
      .map((step) => step.name);
  }

  return { rowsWithoutReactionPlan, overdueInstruments, missingPfmeaControls };
}
