"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { assertSupplierUser } from "@/lib/permissions";
import { getBalloonsForPpap } from "@/lib/data/design-record";
import { importDimensionalReportWorkbook, ensureDefaultSampleColumns } from "@/lib/dimensional-report-import";
import { parseDimensionAndTolerance, computeStatus, type ReadingStatus } from "@/lib/calc/tolerance";
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

function revalidateDimensionalReport(ppapId: string) {
  revalidatePath(`/ppap/${ppapId}/9`);
  revalidatePath(`/ppap/${ppapId}/9/print`);
  revalidatePath(`/ppap/${ppapId}`);
}

function str(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

function dateOrNull(v: string | undefined): Date | null {
  return v ? new Date(v) : null;
}

async function getOrCreateDetail(ppapElementId: string) {
  const existing = await prisma.dimensionalReportDetail.findUnique({ where: { ppapElementId } });
  if (existing) return existing;
  const created = await prisma.dimensionalReportDetail.create({ data: { ppapElementId } });
  await ensureDefaultSampleColumns(created.id);
  return created;
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

export async function saveDimensionalReportHeader(ppapElementId: string, formData: FormData) {
  const element = await assertEditable(ppapElementId);
  const detail = await getOrCreateDetail(ppapElementId);

  await prisma.dimensionalReportDetail.update({
    where: { id: detail.id },
    data: {
      reportDate: dateOrNull(str(formData, "reportDate")),
      reportSlNo: str(formData, "reportSlNo") ?? null,
      comments: str(formData, "comments") ?? null,
    },
  });

  revalidateDimensionalReport(element.ppapId);
}

// ---------------------------------------------------------------------------
// Sample columns
// ---------------------------------------------------------------------------

export async function addSampleColumn(ppapElementId: string, label: string) {
  const element = await assertEditable(ppapElementId);
  const detail = await getOrCreateDetail(ppapElementId);
  const count = await prisma.dimensionalReportSampleColumn.count({ where: { dimensionalReportDetailId: detail.id } });
  await prisma.dimensionalReportSampleColumn.create({
    data: { dimensionalReportDetailId: detail.id, label, sortOrder: count },
  });
  revalidateDimensionalReport(element.ppapId);
}

export async function deleteSampleColumn(columnId: string, ppapElementId: string) {
  const element = await assertEditable(ppapElementId);
  await prisma.dimensionalReportReading.deleteMany({ where: { sampleColumnId: columnId } });
  await prisma.dimensionalReportSampleColumn.delete({ where: { id: columnId } });
  revalidateDimensionalReport(element.ppapId);
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

const rowSchema = z.object({
  id: z.string().optional(),
  slNo: z.string().optional(),
  view: z.string().optional(),
  parameterDescription: z.string().optional(),
  designDimensionText: z.string().optional(),
  toleranceText: z.string().optional(),
  instrumentId: z.string().optional(),
  instrumentUsedText: z.string().optional(),
  remarks: z.string().optional(),
});
export type DimensionalReportRowInput = z.input<typeof rowSchema>;

export async function upsertDimensionalReportRow(ppapElementId: string, input: DimensionalReportRowInput) {
  const element = await assertEditable(ppapElementId);
  const data = rowSchema.parse(input);
  const previous = data.id ? await prisma.dimensionalReportRow.findUnique({ where: { id: data.id }, select: { instrumentId: true } }) : null;
  await assertInstrumentPickable(data.instrumentId, previous?.instrumentId);

  const rowData = {
    slNo: data.slNo || "",
    view: data.view || null,
    parameterDescription: data.parameterDescription || null,
    designDimensionText: data.designDimensionText || null,
    toleranceText: data.toleranceText || null,
    instrumentId: data.instrumentId || null,
    instrumentUsedText: data.instrumentUsedText || null,
    remarks: data.remarks || null,
  };

  if (data.id) {
    await prisma.dimensionalReportRow.update({ where: { id: data.id }, data: rowData });
  } else {
    const detail = await getOrCreateDetail(ppapElementId);
    const count = await prisma.dimensionalReportRow.count({ where: { dimensionalReportDetailId: detail.id } });
    await prisma.dimensionalReportRow.create({ data: { ...rowData, dimensionalReportDetailId: detail.id, sortOrder: count } });
  }

  revalidateDimensionalReport(element.ppapId);
}

export async function deleteDimensionalReportRow(rowId: string, ppapElementId: string) {
  const element = await assertEditable(ppapElementId);
  await prisma.dimensionalReportReading.deleteMany({ where: { dimensionalReportRowId: rowId } });
  await prisma.dimensionalReportRow.delete({ where: { id: rowId } });
  revalidateDimensionalReport(element.ppapId);
}

export async function moveDimensionalReportRow(rowId: string, ppapElementId: string, direction: "up" | "down") {
  const element = await assertEditable(ppapElementId);

  const row = await prisma.dimensionalReportRow.findUniqueOrThrow({ where: { id: rowId } });
  const all = await prisma.dimensionalReportRow.findMany({
    where: { dimensionalReportDetailId: row.dimensionalReportDetailId },
    orderBy: { sortOrder: "asc" },
  });
  const index = all.findIndex((r) => r.id === rowId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= all.length) return;

  const a = all[index];
  const b = all[swapIndex];
  await prisma.$transaction([
    prisma.dimensionalReportRow.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
    prisma.dimensionalReportRow.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
  ]);

  revalidateDimensionalReport(element.ppapId);
}

// ---------------------------------------------------------------------------
// Readings
// ---------------------------------------------------------------------------

export async function upsertReading(ppapElementId: string, rowId: string, sampleColumnId: string, value: string) {
  const element = await assertEditable(ppapElementId);
  const n = value.trim() === "" ? null : Number(value);
  const parsedValue = n !== null && Number.isFinite(n) ? n : null;

  await prisma.dimensionalReportReading.upsert({
    where: { dimensionalReportRowId_sampleColumnId: { dimensionalReportRowId: rowId, sampleColumnId } },
    update: { value: parsedValue },
    create: { dimensionalReportRowId: rowId, sampleColumnId, value: parsedValue },
  });

  revalidateDimensionalReport(element.ppapId);
}

// ---------------------------------------------------------------------------
// Generate from balloons (element 1)
// ---------------------------------------------------------------------------

export async function generateRowsFromBalloons(ppapElementId: string) {
  const element = await assertEditable(ppapElementId);
  const balloons = await getBalloonsForPpap(element.ppapId);

  const detail = await getOrCreateDetail(ppapElementId);
  const existingRows = await prisma.dimensionalReportRow.findMany({ where: { dimensionalReportDetailId: detail.id } });
  const linkedBalloonIds = new Set(existingRows.map((r) => r.balloonId).filter((id): id is string => !!id));
  const maxSortOrder = existingRows.reduce((m, r) => Math.max(m, r.sortOrder), -1);

  let nextSortOrder = maxSortOrder + 1;
  let added = 0;
  for (const balloon of balloons) {
    if (linkedBalloonIds.has(balloon.id)) continue;
    await prisma.dimensionalReportRow.create({
      data: {
        dimensionalReportDetailId: detail.id,
        balloonId: balloon.id,
        slNo: String(balloon.balloonNo),
        view: balloon.viewSection,
        parameterDescription: balloon.description,
        designDimensionText: balloon.nominal,
        toleranceText: balloon.tolerance,
        sortOrder: nextSortOrder++,
      },
    });
    added++;
  }

  revalidateDimensionalReport(element.ppapId);
  return { added };
}

// ---------------------------------------------------------------------------
// Excel import
// ---------------------------------------------------------------------------

export async function importDimensionalReportExcel(ppapElementId: string, formData: FormData) {
  const element = await assertEditable(ppapElementId);

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    throw new Error("Select a file to import.");
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const result = await importDimensionalReportWorkbook(workbook, ppapElementId);
  revalidateDimensionalReport(element.ppapId);
  return result;
}

// ---------------------------------------------------------------------------
// Pickers
// ---------------------------------------------------------------------------

export async function getInstrumentsForDimensionalReportPicker() {
  return getInstrumentsForPicker();
}

// ---------------------------------------------------------------------------
// Conformance summary
// ---------------------------------------------------------------------------

export type RowStatus = { rowId: string; slNo: string; view: string | null; status: ReadingStatus };

export async function getConformanceSummary(ppapElementId: string) {
  const detail = await prisma.dimensionalReportDetail.findUnique({
    where: { ppapElementId },
    include: { rows: { orderBy: { sortOrder: "asc" }, include: { readings: true } } },
  });
  const rows = detail?.rows ?? [];

  const statuses: RowStatus[] = rows.map((row) => {
    const parsed = parseDimensionAndTolerance(row.designDimensionText, row.toleranceText);
    // A row is NG if ANY of its sample-column readings is out of tolerance;
    // OK only once every entered reading is in tolerance; UNKNOWN if no
    // reading has been entered yet (or the dimension/tolerance text itself
    // can't be parsed).
    const enteredValues = row.readings.map((r) => r.value).filter((v): v is number => v !== null);
    if (enteredValues.length === 0 || !parsed) {
      return { rowId: row.id, slNo: row.slNo, view: row.view, status: "UNKNOWN" as ReadingStatus };
    }
    const anyNg = enteredValues.some((v) => computeStatus(v, parsed) === "NG");
    return { rowId: row.id, slNo: row.slNo, view: row.view, status: anyNg ? "NG" : ("OK" as ReadingStatus) };
  });

  const checked = statuses.filter((s) => s.status !== "UNKNOWN").length;
  const ok = statuses.filter((s) => s.status === "OK").length;
  const ng = statuses.filter((s) => s.status === "NG").length;
  const pctConformance = checked > 0 ? Math.round((ok / checked) * 100) : 0;
  const ngRows = statuses.filter((s) => s.status === "NG");

  return { total: rows.length, checked, ok, ng, pctConformance, ngRows };
}

export async function copyDimensionalReportSummaryToChecklist(ppapId: string) {
  const element = await prisma.ppapElement.findUniqueOrThrow({ where: { ppapId_elementNo: { ppapId, elementNo: 9 } } });
  const summary = await getConformanceSummary(element.id);
  const text = `${summary.checked} checked, ${summary.ok} OK, ${summary.ng} NG (${summary.pctConformance}% conformance)`;

  await prisma.checklistRow.upsert({
    where: { ppapId_elementNo: { ppapId, elementNo: 9 } },
    update: { remarks: text },
    create: { ppapId, elementNo: 9, remarks: text },
  });
  revalidatePath(`/ppap/${ppapId}/0`);
  revalidatePath(`/ppap/${ppapId}/0/print`);
  return { summary, text };
}
