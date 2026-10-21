"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertSupplierUser } from "@/lib/permissions";
import { calculateGrr, type GrrReadings, type GrrResult } from "@/lib/calc/grr";
import { getInstrumentsForPicker } from "@/lib/actions/control-plan";
import { assertInstrumentPickable } from "@/lib/instruments";

async function assertEditable(ppapElementId: string) {
  await assertSupplierUser();
  const element = await prisma.ppapElement.findUniqueOrThrow({ where: { id: ppapElementId } });
  if (element.status === "APPROVED") {
    throw new Error("This page is approved and locked. Use Revise to edit it.");
  }
  return element;
}

function revalidateMsa(ppapId: string) {
  revalidatePath(`/ppap/${ppapId}/8`);
  revalidatePath(`/ppap/${ppapId}/8/print`);
  revalidatePath(`/ppap/${ppapId}`);
}

function str(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

function dateOrNull(v: string | undefined): Date | null {
  return v ? new Date(v) : null;
}

function floatOrNull(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function intOrDefault(v: string | undefined, fallback: number): number {
  if (!v) return fallback;
  const n = Number(v);
  return Number.isInteger(n) ? n : fallback;
}

const studySchema = z.object({
  studyType: z.enum(["VARIABLE_GRR", "ATTRIBUTE_AGREEMENT", "BIAS", "LINEARITY", "STABILITY"]).optional(),
  method: z.enum(["AVERAGE_RANGE", "ANOVA"]).optional(),
  studyDate: z.string().optional(),
  units: z.string().optional(),
  gaugeId: z.string().optional(),
  gaugeType: z.string().optional(),
  controlPlanRowId: z.string().optional(),
  characteristicText: z.string().optional(),
  specification: z.string().optional(),
  testNo: z.string().optional(),
  appraiserAName: z.string().optional(),
  appraiserBName: z.string().optional(),
  appraiserCName: z.string().optional(),
  parts: z.string().optional(),
  appraisers: z.string().optional(),
  trials: z.string().optional(),
  usl: z.string().optional(),
  lsl: z.string().optional(),
  notes: z.string().optional(),
});

function studyDataFromForm(formData: FormData) {
  const data = studySchema.parse({
    studyType: str(formData, "studyType"),
    method: str(formData, "method"),
    studyDate: str(formData, "studyDate"),
    units: str(formData, "units"),
    gaugeId: str(formData, "gaugeId"),
    gaugeType: str(formData, "gaugeType"),
    controlPlanRowId: str(formData, "controlPlanRowId"),
    characteristicText: str(formData, "characteristicText"),
    specification: str(formData, "specification"),
    testNo: str(formData, "testNo"),
    appraiserAName: str(formData, "appraiserAName"),
    appraiserBName: str(formData, "appraiserBName"),
    appraiserCName: str(formData, "appraiserCName"),
    parts: str(formData, "parts"),
    appraisers: str(formData, "appraisers"),
    trials: str(formData, "trials"),
    usl: str(formData, "usl"),
    lsl: str(formData, "lsl"),
    notes: str(formData, "notes"),
  });

  const appraisers = intOrDefault(data.appraisers, 3);
  const trials = intOrDefault(data.trials, 3);
  if (appraisers < 2 || appraisers > 3) throw new Error("Appraisers must be 2 or 3.");
  if (trials < 2 || trials > 3) throw new Error("Trials must be 2 or 3.");

  return {
    studyType: data.studyType ?? "VARIABLE_GRR",
    method: data.method ?? "AVERAGE_RANGE",
    studyDate: dateOrNull(data.studyDate),
    units: data.units ?? null,
    gaugeId: data.gaugeId ?? null,
    gaugeType: data.gaugeType ?? null,
    controlPlanRowId: data.controlPlanRowId ?? null,
    characteristicText: data.characteristicText ?? null,
    specification: data.specification ?? null,
    testNo: data.testNo ?? null,
    appraiserAName: data.appraiserAName ?? null,
    appraiserBName: data.appraiserBName ?? null,
    appraiserCName: data.appraiserCName ?? null,
    parts: intOrDefault(data.parts, 10),
    appraisers,
    trials,
    usl: floatOrNull(data.usl),
    lsl: floatOrNull(data.lsl),
    notes: data.notes ?? null,
  };
}

export async function createStudy(ppapElementId: string, formData: FormData) {
  const element = await assertEditable(ppapElementId);
  const data = studyDataFromForm(formData);
  await assertInstrumentPickable(data.gaugeId);
  const count = await prisma.msaStudy.count({ where: { ppapElementId } });
  const study = await prisma.msaStudy.create({ data: { ppapElementId, ...data, sortOrder: count } });
  revalidateMsa(element.ppapId);
  return study;
}

export async function updateStudy(studyId: string, ppapElementId: string, formData: FormData) {
  const element = await assertEditable(ppapElementId);
  const data = studyDataFromForm(formData);
  const previous = await prisma.msaStudy.findUniqueOrThrow({ where: { id: studyId }, select: { gaugeId: true } });
  await assertInstrumentPickable(data.gaugeId, previous.gaugeId);
  await prisma.msaStudy.update({ where: { id: studyId }, data });
  // Dimensions may have shrunk — drop any now-out-of-range data points
  // rather than leaving orphaned rows a smaller grid can never show again.
  await prisma.msaDataPoint.deleteMany({
    where: {
      msaStudyId: studyId,
      OR: [
        { partIndex: { gte: data.parts } },
        { appraiserIndex: { gte: data.appraisers } },
        { trialIndex: { gte: data.trials } },
      ],
    },
  });
  revalidateMsa(element.ppapId);
}

export async function deleteStudy(studyId: string, ppapElementId: string) {
  const element = await assertEditable(ppapElementId);
  await prisma.msaDataPoint.deleteMany({ where: { msaStudyId: studyId } });
  await prisma.msaStudy.delete({ where: { id: studyId } });
  revalidateMsa(element.ppapId);
}

export type DataPointInput = { appraiserIndex: number; partIndex: number; trialIndex: number; value: number | null };

export async function saveMsaData(studyId: string, ppapElementId: string, points: DataPointInput[]) {
  const element = await assertEditable(ppapElementId);

  const withValues = points.filter((p) => p.value !== null && Number.isFinite(p.value));
  await prisma.msaDataPoint.deleteMany({ where: { msaStudyId: studyId } });
  if (withValues.length > 0) {
    await prisma.msaDataPoint.createMany({
      data: withValues.map((p) => ({
        id: randomUUID(),
        msaStudyId: studyId,
        appraiserIndex: p.appraiserIndex,
        partIndex: p.partIndex,
        trialIndex: p.trialIndex,
        value: p.value,
      })),
    });
  }

  revalidateMsa(element.ppapId);
}

export type StudyResults = { complete: boolean; filled: number; expected: number; result: GrrResult | null };

export async function getStudyResults(studyId: string): Promise<StudyResults> {
  const study = await prisma.msaStudy.findUniqueOrThrow({ where: { id: studyId }, include: { dataPoints: true } });
  const { parts, appraisers, trials } = study;
  const expected = parts * appraisers * trials;
  const filled = study.dataPoints.length;

  if (filled < expected || study.method !== "AVERAGE_RANGE") {
    return { complete: false, filled, expected, result: null };
  }

  const readings: GrrReadings = Array.from({ length: appraisers }, () =>
    Array.from({ length: parts }, () => Array.from({ length: trials }, () => NaN)),
  );
  for (const dp of study.dataPoints) {
    if (dp.value === null) continue;
    readings[dp.appraiserIndex][dp.partIndex][dp.trialIndex] = dp.value;
  }
  if (readings.some((byPart) => byPart.some((byTrial) => byTrial.some((v) => Number.isNaN(v))))) {
    return { complete: false, filled, expected, result: null };
  }

  const result = calculateGrr({ readings, parts, appraisers, trials, usl: study.usl, lsl: study.lsl });
  return { complete: true, filled, expected, result };
}

export async function getInstrumentsForGaugePicker() {
  return getInstrumentsForPicker();
}

export async function getControlPlanRowsForCharacteristicPicker(ppapId: string) {
  const controlPlanElement = await prisma.ppapElement.findUnique({
    where: { ppapId_elementNo: { ppapId, elementNo: 7 } },
  });
  if (!controlPlanElement) return [];
  const detail = await prisma.controlPlanDetail.findUnique({
    where: { ppapElementId: controlPlanElement.id },
    include: { rows: { orderBy: { sortOrder: "asc" } } },
  });
  return detail?.rows ?? [];
}

export async function copyMsaSummaryToChecklist(ppapId: string, summary: string) {
  await prisma.checklistRow.upsert({
    where: { ppapId_elementNo: { ppapId, elementNo: 8 } },
    update: { remarks: summary },
    create: { ppapId, elementNo: 8, remarks: summary },
  });
  revalidatePath(`/ppap/${ppapId}/0`);
  revalidatePath(`/ppap/${ppapId}/0/print`);
}
