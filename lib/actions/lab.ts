"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { assertSupplierUser } from "@/lib/permissions";
import { saveUploadedFile } from "@/lib/storage";
import { isLabPickable, parseLimitText } from "@/lib/calc/lab";
import { getMaterialSpecsForPicker } from "@/lib/actions/rmtc";
import type { LabMechanicalProperty, LabChemicalElement, LabPaintProperty } from "@/app/generated/prisma/enums";

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

function revalidateLab(ppapId: string) {
  revalidatePath(`/ppap/${ppapId}/12`);
  revalidatePath(`/ppap/${ppapId}/12/print`);
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

function num(v: unknown): number | null {
  return v === null || v === undefined ? null : Number(v);
}

const DEFAULT_TEST_DETAILS = ["Chemical Analysis", "Tensile", "Hardness", "Impact", "Coating Thickness (DFT)", "Adhesion"];

// ---------------------------------------------------------------------------
// Pickers
// ---------------------------------------------------------------------------

export async function getLabsForPicker() {
  const labs = await prisma.labMaster.findMany({ orderBy: { name: "asc" } });
  return labs.map((l) => ({ ...l, pickable: isLabPickable(l.validUntil) }));
}

export async function getMaterialSpecsForLabPicker() {
  return getMaterialSpecsForPicker();
}

export async function getHeatBatchOptionsForPpap(ppapId: string) {
  const rmtcElement = await prisma.ppapElement.findUnique({ where: { ppapId_elementNo: { ppapId, elementNo: 10 } } });
  if (!rmtcElement) return [];
  const detail = await prisma.rmtcReportDetail.findUnique({
    where: { ppapElementId: rmtcElement.id },
    include: { rows: { orderBy: { sortOrder: "asc" } } },
  });
  return (detail?.rows ?? []).filter((r) => r.heatNo).map((r) => ({ id: r.id, heatNo: r.heatNo!, partNo: r.partNo }));
}

// ---------------------------------------------------------------------------
// Auto-fill: Mechanical/Chemical requirements from MaterialSpec, Paint
// requirement from a best-effort matching Control Plan row
// ---------------------------------------------------------------------------

async function applyMaterialSpecDefaults(reportId: string, materialSpecId: string | null) {
  const spec = materialSpecId ? await prisma.materialSpec.findUnique({ where: { id: materialSpecId } }) : null;
  // Hardness has no numeric columns on MaterialSpec; derive limits from its
  // note when it states them ("Max 160 HB"), keeping the note as the label.
  const hardness = parseLimitText(spec?.hardnessNote);

  const mechanical: { property: LabMechanicalProperty; min: number | null; max: number | null; text: string | null }[] = [
    { property: "YIELD_STRENGTH", min: num(spec?.ysMinMpa), max: null, text: null },
    { property: "UTS", min: num(spec?.utsMinMpa), max: num(spec?.utsMaxMpa), text: null },
    { property: "ELONGATION", min: num(spec?.elongationMinPct), max: null, text: null },
    { property: "HARDNESS", min: hardness?.min ?? null, max: hardness?.max ?? null, text: spec?.hardnessNote ?? null },
    { property: "IMPACT", min: num(spec?.impactMinJ), max: null, text: null },
  ];
  for (const m of mechanical) {
    await prisma.labMechanicalResult.upsert({
      where: { labReportId_property: { labReportId: reportId, property: m.property } },
      update: { requirementMin: m.min, requirementMax: m.max, requirementText: m.text },
      create: { labReportId: reportId, property: m.property, requirementMin: m.min, requirementMax: m.max, requirementText: m.text },
    });
  }

  const chemical: { element: LabChemicalElement; min: number | null; max: number | null; text: string | null }[] = [
    { element: "C", min: num(spec?.cMin), max: num(spec?.cMax), text: null },
    { element: "MN", min: num(spec?.mnMin), max: num(spec?.mnMax), text: null },
    { element: "SI", min: num(spec?.siMin), max: num(spec?.siMax), text: null },
    { element: "S", min: num(spec?.sMin), max: num(spec?.sMax), text: null },
    { element: "P", min: num(spec?.pMin), max: num(spec?.pMax), text: null },
    { element: "CR", min: num(spec?.crMin), max: num(spec?.crMax), text: null },
    { element: "NI", min: num(spec?.niMin), max: num(spec?.niMax), text: null },
    { element: "MO", min: num(spec?.moMin), max: num(spec?.moMax), text: null },
    { element: "OTHER", min: null, max: null, text: spec?.otherNote ?? null },
  ];
  for (const c of chemical) {
    await prisma.labChemicalResult.upsert({
      where: { labReportId_element: { labReportId: reportId, element: c.element } },
      update: { requirementMin: c.min, requirementMax: c.max, requirementText: c.text },
      create: { labReportId: reportId, element: c.element, requirementMin: c.min, requirementMax: c.max, requirementText: c.text },
    });
  }
}

function looksNumeric(text: string | null | undefined): boolean {
  return !!text && /\d/.test(text);
}

async function applyPaintDefaults(ppapId: string, reportId: string) {
  const controlPlanElement = await prisma.ppapElement.findUnique({ where: { ppapId_elementNo: { ppapId, elementNo: 7 } } });
  const detail = controlPlanElement
    ? await prisma.controlPlanDetail.findUnique({
        where: { ppapElementId: controlPlanElement.id },
        include: { rows: { orderBy: { sortOrder: "asc" } } },
      })
    : null;
  const rows = detail?.rows ?? [];

  function findRow(keyword: RegExp) {
    return rows.find((r) => keyword.test(r.productCharacteristic ?? ""));
  }

  const paint: { property: LabPaintProperty; row: (typeof rows)[number] | undefined }[] = [
    { property: "DFT", row: findRow(/d\.?f\.?t/i) },
    { property: "ADHESION", row: findRow(/adhes|cross hatch/i) },
    { property: "GLOSS", row: findRow(/gloss/i) },
    { property: "VISUAL", row: findRow(/appearance/i) },
  ];

  for (const p of paint) {
    const requirementText = p.row
      ? looksNumeric(p.row.evaluationMeasurementTechnique)
        ? p.row.evaluationMeasurementTechnique
        : p.row.productProcessSpecification
      : null;
    await prisma.labPaintResult.upsert({
      where: { labReportId_property: { labReportId: reportId, property: p.property } },
      update: { requirementText },
      create: { labReportId: reportId, property: p.property, requirementText },
    });
  }
}

async function ensureDefaultTestDetails(reportId: string) {
  const existing = await prisma.labTestDetail.count({ where: { labReportId: reportId } });
  if (existing > 0) return;
  await prisma.labTestDetail.createMany({
    data: DEFAULT_TEST_DETAILS.map((testName, i) => ({ labReportId: reportId, testName, sortOrder: i })),
  });
}

// ---------------------------------------------------------------------------
// Report CRUD
// ---------------------------------------------------------------------------

const reportSchema = z.object({
  companyName: z.string().optional(),
  labId: z.string().optional(),
  reportNo: z.string().optional(),
  testDate: z.string().optional(),
  materialSpecId: z.string().optional(),
  materialGradeText: z.string().optional(),
  rmtcReportRowId: z.string().optional(),
  heatBatchNoText: z.string().optional(),
  sampleQty: z.string().optional(),
  manufacturingProcess: z.string().optional(),
  heatTreatmentStatus: z.string().optional(),
});

async function reportDataFromForm(formData: FormData) {
  const data = reportSchema.parse({
    companyName: str(formData, "companyName"),
    labId: str(formData, "labId"),
    reportNo: str(formData, "reportNo"),
    testDate: str(formData, "testDate"),
    materialSpecId: str(formData, "materialSpecId"),
    materialGradeText: str(formData, "materialGradeText"),
    rmtcReportRowId: str(formData, "rmtcReportRowId"),
    heatBatchNoText: str(formData, "heatBatchNoText"),
    sampleQty: str(formData, "sampleQty"),
    manufacturingProcess: str(formData, "manufacturingProcess"),
    heatTreatmentStatus: str(formData, "heatTreatmentStatus"),
  });

  if (data.labId) {
    const lab = await prisma.labMaster.findUniqueOrThrow({ where: { id: data.labId } });
    if (!isLabPickable(lab.validUntil)) {
      throw new Error(`"${lab.name}" is expired and cannot be selected.`);
    }
  }

  return {
    companyName: data.companyName ?? null,
    labId: data.labId ?? null,
    reportNo: data.reportNo ?? null,
    testDate: dateOrNull(data.testDate),
    materialSpecId: data.materialSpecId ?? null,
    materialGradeText: data.materialGradeText ?? null,
    rmtcReportRowId: data.rmtcReportRowId ?? null,
    heatBatchNoText: data.heatBatchNoText ?? null,
    sampleQty: data.sampleQty ? Math.trunc(Number(data.sampleQty)) : null,
    manufacturingProcess: data.manufacturingProcess ?? null,
    heatTreatmentStatus: data.heatTreatmentStatus ?? null,
  };
}

export async function createLabReport(ppapElementId: string, formData: FormData) {
  const element = await assertEditable(ppapElementId);
  const data = await reportDataFromForm(formData);
  const count = await prisma.labReport.count({ where: { ppapElementId } });
  const report = await prisma.labReport.create({ data: { ppapElementId, ...data, sortOrder: count } });

  await ensureDefaultTestDetails(report.id);
  await applyMaterialSpecDefaults(report.id, data.materialSpecId);
  await applyPaintDefaults(element.ppapId, report.id);

  await audit({ ppapId: element.ppapId, action: "CREATE", entityType: "LabReport", entityId: report.id, before: null, after: report });
  revalidateLab(element.ppapId);
  return report;
}

export async function updateLabReport(reportId: string, ppapElementId: string, formData: FormData) {
  const element = await assertEditable(ppapElementId);
  const data = await reportDataFromForm(formData);
  const before = await prisma.labReport.findUniqueOrThrow({ where: { id: reportId } });
  const after = await prisma.labReport.update({ where: { id: reportId }, data });
  await audit({ ppapId: element.ppapId, action: "UPDATE", entityType: "LabReport", entityId: reportId, before, after });

  // Re-derive Mechanical/Chemical requirements whenever the material grade
  // changes — "choosing E250 BR fills all limits" applies on edit too, and
  // this only touches requirementMin/Max/Text, never the typed result.
  await applyMaterialSpecDefaults(reportId, data.materialSpecId);

  revalidateLab(element.ppapId);
}

export async function deleteLabReport(reportId: string, ppapElementId: string) {
  const element = await assertEditable(ppapElementId);
  const before = await prisma.labReport.findUniqueOrThrow({
    where: { id: reportId },
    include: { testDetails: true, mechanicalResults: true, chemicalResults: true, paintResults: true },
  });
  await prisma.labTestDetail.deleteMany({ where: { labReportId: reportId } });
  await prisma.labMechanicalResult.deleteMany({ where: { labReportId: reportId } });
  await prisma.labChemicalResult.deleteMany({ where: { labReportId: reportId } });
  await prisma.labPaintResult.deleteMany({ where: { labReportId: reportId } });
  await prisma.labReport.delete({ where: { id: reportId } });
  await audit({ ppapId: element.ppapId, action: "DELETE", entityType: "LabReport", entityId: reportId, before, after: null });
  revalidateLab(element.ppapId);
}

// ---------------------------------------------------------------------------
// Test details (which tests were performed and how)
// ---------------------------------------------------------------------------

const testDetailSchema = z.object({
  id: z.string().optional(),
  testName: z.string().optional(),
  acceptanceCriteria: z.string().optional(),
  methodEquipment: z.string().optional(),
  standard: z.string().optional(),
});
export type LabTestDetailInput = z.input<typeof testDetailSchema>;

export async function upsertLabTestDetail(ppapElementId: string, reportId: string, input: LabTestDetailInput) {
  const element = await assertEditable(ppapElementId);
  const data = testDetailSchema.parse(input);
  const rowData = {
    testName: data.testName || "",
    acceptanceCriteria: data.acceptanceCriteria || null,
    methodEquipment: data.methodEquipment || null,
    standard: data.standard || null,
  };
  if (data.id) {
    const before = await prisma.labTestDetail.findUniqueOrThrow({ where: { id: data.id } });
    const after = await prisma.labTestDetail.update({ where: { id: data.id }, data: rowData });
    await audit({ ppapId: element.ppapId, action: "UPDATE", entityType: "LabTestDetail", entityId: data.id, before, after });
  } else {
    const count = await prisma.labTestDetail.count({ where: { labReportId: reportId } });
    const after = await prisma.labTestDetail.create({ data: { ...rowData, labReportId: reportId, sortOrder: count } });
    await audit({ ppapId: element.ppapId, action: "CREATE", entityType: "LabTestDetail", entityId: after.id, before: null, after });
  }
  revalidateLab(element.ppapId);
}

export async function deleteLabTestDetail(testDetailId: string, ppapElementId: string) {
  const element = await assertEditable(ppapElementId);
  const before = await prisma.labTestDetail.delete({ where: { id: testDetailId } });
  await audit({ ppapId: element.ppapId, action: "DELETE", entityType: "LabTestDetail", entityId: testDetailId, before, after: null });
  revalidateLab(element.ppapId);
}

// ---------------------------------------------------------------------------
// Mechanical / Chemical / Paint results
// ---------------------------------------------------------------------------

export async function saveMechanicalResult(
  ppapElementId: string,
  resultId: string,
  data: { result: number | null; unit: string | null; remark: string | null },
) {
  const element = await assertEditable(ppapElementId);
  const before = await prisma.labMechanicalResult.findUniqueOrThrow({ where: { id: resultId } });
  const after = await prisma.labMechanicalResult.update({ where: { id: resultId }, data });
  await audit({ ppapId: element.ppapId, action: "UPDATE", entityType: "LabMechanicalResult", entityId: resultId, before, after });
  revalidateLab(element.ppapId);
}

export async function saveChemicalResult(ppapElementId: string, resultId: string, data: { result: number | null }) {
  const element = await assertEditable(ppapElementId);
  const before = await prisma.labChemicalResult.findUniqueOrThrow({ where: { id: resultId } });
  const after = await prisma.labChemicalResult.update({ where: { id: resultId }, data });
  await audit({ ppapId: element.ppapId, action: "UPDATE", entityType: "LabChemicalResult", entityId: resultId, before, after });
  revalidateLab(element.ppapId);
}

export async function savePaintResult(
  ppapElementId: string,
  resultId: string,
  data: { resultText: string | null; unit: string | null; remark: string | null },
) {
  const element = await assertEditable(ppapElementId);
  const resultNumeric = data.resultText ? floatOrNull(data.resultText) : null;
  const before = await prisma.labPaintResult.findUniqueOrThrow({ where: { id: resultId } });
  const after = await prisma.labPaintResult.update({
    where: { id: resultId },
    data: { resultText: data.resultText, resultNumeric, unit: data.unit, remark: data.remark },
  });
  await audit({ ppapId: element.ppapId, action: "UPDATE", entityType: "LabPaintResult", entityId: resultId, before, after });
  revalidateLab(element.ppapId);
}

// ---------------------------------------------------------------------------
// File uploads
// ---------------------------------------------------------------------------

export async function uploadLabReportPdf(reportId: string, ppapElementId: string, formData: FormData) {
  const element = await assertEditable(ppapElementId);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("A file is required");
  }
  const saved = await saveUploadedFile(file, `ppap-elements/${ppapElementId}/lab`);
  const before = await prisma.labReport.findUniqueOrThrow({ where: { id: reportId } });
  const after = await prisma.labReport.update({
    where: { id: reportId },
    data: { labPdfUrl: saved.url, labPdfName: saved.fileName, labPdfType: saved.fileType },
  });
  await audit({ ppapId: element.ppapId, action: "UPDATE", entityType: "LabReport", entityId: reportId, before, after });
  revalidateLab(element.ppapId);
}
