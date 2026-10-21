"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertSupplierUser } from "@/lib/permissions";
import { parseCombinedSpec } from "@/lib/calc/tolerance";
import {
  computeControlChartStats,
  overallSigma,
  computeCapability,
  computeClientMethod,
  countOutOfSpec,
  computeHistogram,
  spcVerdict,
  spcRemark,
  subgroupMean,
  type SpcVerdict,
} from "@/lib/calc/spc";
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

function revalidateSpc(ppapId: string) {
  revalidatePath(`/ppap/${ppapId}/11`);
  revalidatePath(`/ppap/${ppapId}/11/print`);
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

// ---------------------------------------------------------------------------
// Pickers
// ---------------------------------------------------------------------------

export async function getSpecialCharacteristicsForSpcPicker(ppapId: string) {
  const designRecordElement = await prisma.ppapElement.findUnique({ where: { ppapId_elementNo: { ppapId, elementNo: 1 } } });
  if (!designRecordElement) return [];
  return prisma.specialCharacteristic.findMany({
    where: { ppapElementId: designRecordElement.id },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getInstrumentsForSpcPicker() {
  return getInstrumentsForPicker();
}

/// First Control Plan row (by stage order) naming this special
/// characteristic — the source for the "(auto)" usl/lsl/instrument/least
/// count pre-fill. Most of this PPAP's real Control Plan specs are
/// qualitative text ("As per drawing"), so parseCombinedSpec legitimately
/// returns null for them — that's expected, not a bug.
async function findControlPlanRowForCharacteristic(ppapId: string, specialCharacteristicId: string) {
  const controlPlanElement = await prisma.ppapElement.findUnique({ where: { ppapId_elementNo: { ppapId, elementNo: 7 } } });
  if (!controlPlanElement) return null;
  const detail = await prisma.controlPlanDetail.findUnique({ where: { ppapElementId: controlPlanElement.id } });
  if (!detail) return null;
  return prisma.controlPlanRow.findFirst({
    where: { controlPlanDetailId: detail.id, specialCharacteristicId },
    orderBy: { sortOrder: "asc" },
  });
}

// ---------------------------------------------------------------------------
// Study CRUD
// ---------------------------------------------------------------------------

const studySchema = z.object({
  specialCharacteristicId: z.string().optional(),
  usl: z.string().optional(),
  lsl: z.string().optional(),
  specText: z.string().optional(),
  instrumentId: z.string().optional(),
  leastCountText: z.string().optional(),
  machine: z.string().optional(),
  operation: z.string().optional(),
  studyDate: z.string().optional(),
  dcNo: z.string().optional(),
  qty: z.string().optional(),
  decimals: z.string().optional(),
  subgroupSize: z.string().optional(),
  subgroupCount: z.string().optional(),
  cpkAcceptableMin: z.string().optional(),
  cpkConditionalMin: z.string().optional(),
});

async function studyDataFromForm(ppapId: string, formData: FormData) {
  const data = studySchema.parse({
    specialCharacteristicId: str(formData, "specialCharacteristicId"),
    usl: str(formData, "usl"),
    lsl: str(formData, "lsl"),
    specText: str(formData, "specText"),
    instrumentId: str(formData, "instrumentId"),
    leastCountText: str(formData, "leastCountText"),
    machine: str(formData, "machine"),
    operation: str(formData, "operation"),
    studyDate: str(formData, "studyDate"),
    dcNo: str(formData, "dcNo"),
    qty: str(formData, "qty"),
    decimals: str(formData, "decimals"),
    subgroupSize: str(formData, "subgroupSize"),
    subgroupCount: str(formData, "subgroupCount"),
    cpkAcceptableMin: str(formData, "cpkAcceptableMin"),
    cpkConditionalMin: str(formData, "cpkConditionalMin"),
  });

  let usl = floatOrNull(data.usl);
  let lsl = floatOrNull(data.lsl);
  let specText = data.specText ?? null;
  let instrumentId = data.instrumentId ?? null;
  let leastCountText = data.leastCountText ?? null;

  if (data.specialCharacteristicId && (usl === null || lsl === null || !instrumentId || !leastCountText)) {
    const row = await findControlPlanRowForCharacteristic(ppapId, data.specialCharacteristicId);
    if (row) {
      specText ??= row.productProcessSpecification;
      instrumentId ??= row.instrumentId;
      leastCountText ??= row.leastCountText;
      if (usl === null || lsl === null) {
        const parsed = parseCombinedSpec(row.productProcessSpecification);
        if (parsed) {
          usl ??= parsed.upper;
          lsl ??= parsed.lower;
        }
      }
    }
  }

  return {
    specialCharacteristicId: data.specialCharacteristicId ?? null,
    usl,
    lsl,
    specText,
    instrumentId,
    leastCountText,
    machine: data.machine ?? null,
    operation: data.operation ?? null,
    studyDate: dateOrNull(data.studyDate),
    dcNo: data.dcNo ?? null,
    qty: data.qty ? Math.trunc(Number(data.qty)) : null,
    decimals: intOrDefault(data.decimals, 3),
    subgroupSize: intOrDefault(data.subgroupSize, 5),
    subgroupCount: intOrDefault(data.subgroupCount, 5),
    cpkAcceptableMin: floatOrNull(data.cpkAcceptableMin) ?? 1.67,
    cpkConditionalMin: floatOrNull(data.cpkConditionalMin) ?? 1.33,
  };
}

export async function createSpcStudy(ppapElementId: string, formData: FormData) {
  const element = await assertEditable(ppapElementId);
  await assertInstrumentPickable(str(formData, "instrumentId"));
  const data = await studyDataFromForm(element.ppapId, formData);
  const count = await prisma.spcStudy.count({ where: { ppapElementId } });
  const study = await prisma.spcStudy.create({ data: { ppapElementId, ...data, sortOrder: count } });
  revalidateSpc(element.ppapId);
  return study;
}

export async function updateSpcStudy(studyId: string, ppapElementId: string, formData: FormData) {
  const element = await assertEditable(ppapElementId);
  const previous = await prisma.spcStudy.findUniqueOrThrow({ where: { id: studyId }, select: { instrumentId: true } });
  await assertInstrumentPickable(str(formData, "instrumentId"), previous.instrumentId);
  const data = await studyDataFromForm(element.ppapId, formData);
  await prisma.spcStudy.update({ where: { id: studyId }, data });
  // Grid dimensions may have shrunk — drop any now-out-of-range readings
  // rather than leaving orphaned rows a smaller grid can never show again.
  await prisma.spcReading.deleteMany({
    where: {
      spcStudyId: studyId,
      OR: [{ subgroupIndex: { gte: data.subgroupCount } }, { withinIndex: { gte: data.subgroupSize } }],
    },
  });
  revalidateSpc(element.ppapId);
}

export async function deleteSpcStudy(studyId: string, ppapElementId: string) {
  const element = await assertEditable(ppapElementId);
  await prisma.spcReading.deleteMany({ where: { spcStudyId: studyId } });
  await prisma.spcStudy.delete({ where: { id: studyId } });
  revalidateSpc(element.ppapId);
}

// ---------------------------------------------------------------------------
// Readings (one grid drives both the X̄-R/histogram view and the
// individuals run chart view)
// ---------------------------------------------------------------------------

export type SpcReadingInput = { subgroupIndex: number; withinIndex: number; value: number | null };

export async function saveSpcData(studyId: string, ppapElementId: string, points: SpcReadingInput[]) {
  const element = await assertEditable(ppapElementId);

  const withValues = points.filter((p) => p.value !== null && Number.isFinite(p.value));
  await prisma.spcReading.deleteMany({ where: { spcStudyId: studyId } });
  if (withValues.length > 0) {
    await prisma.spcReading.createMany({
      data: withValues.map((p) => ({
        id: randomUUID(),
        spcStudyId: studyId,
        subgroupIndex: p.subgroupIndex,
        withinIndex: p.withinIndex,
        value: p.value,
      })),
    });
  }

  revalidateSpc(element.ppapId);
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export type SpcStudyResults = {
  complete: true;
  filled: number;
  expected: number;
  xBarBar: number;
  rBar: number;
  sigmaWithin: number;
  xBarUcl: number;
  xBarLcl: number;
  rUcl: number;
  rLcl: number;
  sigmaOverall: number;
  overallMean: number;
  cp: number;
  cpk: number;
  pp: number;
  ppk: number;
  clientK: number;
  clientCp: number;
  clientCpk: number;
  designCentre: number;
  specWidth: number;
  aboveUsl: number;
  belowLsl: number;
  histogram: ReturnType<typeof computeHistogram>;
  verdict: SpcVerdict;
  remark: string;
  individuals: number[];
} | { complete: false; filled: number; expected: number };

export async function getSpcStudyResults(studyId: string): Promise<SpcStudyResults> {
  const study = await prisma.spcStudy.findUniqueOrThrow({ where: { id: studyId }, include: { readings: true } });
  const { subgroupSize, subgroupCount, usl, lsl } = study;
  const expected = subgroupSize * subgroupCount;
  const filled = study.readings.length;

  if (filled < expected || usl === null || lsl === null) {
    return { complete: false, filled, expected };
  }

  const subgroups: number[][] = Array.from({ length: subgroupCount }, () => Array.from({ length: subgroupSize }, () => NaN));
  for (const r of study.readings) {
    if (r.value === null) continue;
    if (r.subgroupIndex < subgroupCount && r.withinIndex < subgroupSize) subgroups[r.subgroupIndex][r.withinIndex] = r.value;
  }
  if (subgroups.some((sg) => sg.some((v) => Number.isNaN(v)))) {
    return { complete: false, filled, expected };
  }

  const individuals = subgroups.flat();
  const ccs = computeControlChartStats(subgroups);
  const sigmaOverall = overallSigma(individuals);
  const overallMean = subgroupMean(individuals);
  const cap = computeCapability({ usl, lsl, xBarBar: ccs.xBarBar, overallMean, sigmaWithin: ccs.sigmaWithin, sigmaOverall });
  const client = computeClientMethod({ usl, lsl, mean: overallMean, sigmaOverall });
  const outOfSpec = countOutOfSpec(individuals, usl, lsl);
  const histogram = computeHistogram(individuals);
  const thresholds = { acceptable: study.cpkAcceptableMin, conditional: study.cpkConditionalMin };
  const verdict = spcVerdict(client.cpk, thresholds);
  const remark = spcRemark(client.cpk, thresholds);

  return {
    complete: true,
    filled,
    expected,
    xBarBar: ccs.xBarBar,
    rBar: ccs.rBar,
    sigmaWithin: ccs.sigmaWithin,
    xBarUcl: ccs.xBarUcl,
    xBarLcl: ccs.xBarLcl,
    rUcl: ccs.rUcl,
    rLcl: ccs.rLcl,
    sigmaOverall,
    overallMean,
    cp: cap.cp,
    cpk: cap.cpk,
    pp: cap.pp,
    ppk: cap.ppk,
    clientK: client.k,
    clientCp: client.cp,
    clientCpk: client.cpk,
    designCentre: client.designCentre,
    specWidth: client.specWidth,
    aboveUsl: outOfSpec.aboveUsl,
    belowLsl: outOfSpec.belowLsl,
    histogram,
    verdict,
    remark,
    individuals,
  };
}

// ---------------------------------------------------------------------------
// Element summary — minimum Cpk across studies (feeds Checklist and, once
// built, PSW).
// ---------------------------------------------------------------------------

export async function getElement11Summary(ppapId: string) {
  const element = await prisma.ppapElement.findUnique({ where: { ppapId_elementNo: { ppapId, elementNo: 11 } } });
  if (!element) return { studyCount: 0, completeCount: 0, minCpk: null, verdict: null as SpcVerdict | null };

  const studies = await prisma.spcStudy.findMany({ where: { ppapElementId: element.id } });
  const results = await Promise.all(studies.map((s) => getSpcStudyResults(s.id)));
  const complete = results.filter((r): r is SpcStudyResults & { complete: true } => r.complete);
  if (complete.length === 0) {
    return { studyCount: studies.length, completeCount: 0, minCpk: null, verdict: null as SpcVerdict | null };
  }

  const minCpk = Math.min(...complete.map((r) => r.clientCpk));
  return { studyCount: studies.length, completeCount: complete.length, minCpk, verdict: spcVerdict(minCpk) };
}

export async function copySpcSummaryToChecklist(ppapId: string) {
  const summary = await getElement11Summary(ppapId);
  const text =
    summary.minCpk === null
      ? `${summary.studyCount} study(ies), no complete results yet.`
      : `${summary.completeCount}/${summary.studyCount} study(ies) complete, min Cpk = ${summary.minCpk.toFixed(3)} (${summary.verdict}).`;

  await prisma.checklistRow.upsert({
    where: { ppapId_elementNo: { ppapId, elementNo: 11 } },
    update: { remarks: text },
    create: { ppapId, elementNo: 11, remarks: text },
  });
  revalidatePath(`/ppap/${ppapId}/0`);
  revalidatePath(`/ppap/${ppapId}/0/print`);
  return { summary, text };
}
