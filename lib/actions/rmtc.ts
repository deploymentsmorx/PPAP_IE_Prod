"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { assertSupplierUser } from "@/lib/permissions";
import { saveUploadedFile } from "@/lib/storage";
import { getDefaultMaterialSpecId } from "@/lib/data/design-record";
import { importRmtcWorkbook } from "@/lib/rmtc-import";

async function assertEditable(ppapElementId: string) {
  await assertSupplierUser();
  const element = await prisma.ppapElement.findUniqueOrThrow({ where: { id: ppapElementId } });
  if (element.status === "APPROVED") {
    throw new Error("This page is approved and locked. Use Revise to edit it.");
  }
  return element;
}

function revalidateRmtc(ppapId: string) {
  revalidatePath(`/ppap/${ppapId}/10`);
  revalidatePath(`/ppap/${ppapId}/10/print`);
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
  const existing = await prisma.rmtcReportDetail.findUnique({ where: { ppapElementId } });
  if (existing) return existing;
  return prisma.rmtcReportDetail.create({ data: { ppapElementId } });
}

async function getPartId(ppapId: string): Promise<string> {
  const ppap = await prisma.ppap.findUniqueOrThrow({
    where: { id: ppapId },
    select: { partRevision: { select: { partId: true } } },
  });
  return ppap.partRevision.partId;
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

export async function saveRmtcHeader(ppapElementId: string, formData: FormData) {
  const element = await assertEditable(ppapElementId);
  const detail = await getOrCreateDetail(ppapElementId);

  const thicknessToleranceMm = str(formData, "thicknessToleranceMm");
  const widthToleranceMm = str(formData, "widthToleranceMm");
  const lengthToleranceMm = str(formData, "lengthToleranceMm");

  await prisma.rmtcReportDetail.update({
    where: { id: detail.id },
    data: {
      projectName: str(formData, "projectName") ?? null,
      otherRef: str(formData, "otherRef") ?? null,
      codeNo: str(formData, "codeNo") ?? null,
      supplierName: str(formData, "supplierName") ?? null,
      thicknessToleranceMm: thicknessToleranceMm ? Number(thicknessToleranceMm) : undefined,
      widthToleranceMm: widthToleranceMm ? Number(widthToleranceMm) : undefined,
      lengthToleranceMm: lengthToleranceMm ? Number(lengthToleranceMm) : undefined,
      reportRemarks: str(formData, "reportRemarks") ?? null,
      customerWitnessName: str(formData, "customerWitnessName") ?? null,
      customerWitnessAt: dateOrNull(str(formData, "customerWitnessAt")),
    },
  });

  revalidateRmtc(element.ppapId);
}

// ---------------------------------------------------------------------------
// Pickers
// ---------------------------------------------------------------------------

export async function getMaterialSpecsForPicker() {
  // select only the plain fields the picker needs — MaterialSpec also
  // carries Decimal chemical/mechanical limits, which can't cross the
  // server/client boundary as component props.
  return prisma.materialSpec.findMany({
    select: { id: true, standard: true, grade: true },
    orderBy: [{ standard: "asc" }, { grade: "asc" }],
  });
}

export async function getDefaultMaterialSpecForRow(ppapId: string) {
  return getDefaultMaterialSpecId(ppapId);
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

const rowSchema = z.object({
  id: z.string().optional(),
  slNo: z.string().optional(),
  partNo: z.string().optional(),
  materialSpecId: z.string().optional(),
  requiredSizeText: z.string().optional(),
  qtyNos: z.string().optional(),
  observedSizeText: z.string().optional(),
  millTcNo: z.string().optional(),
  millTcDate: z.string().optional(),
  heatNo: z.string().optional(),
  plateNo: z.string().optional(),
  materialIdNo: z.string().optional(),
  labReportNo: z.string().optional(),
  remarks: z.string().optional(),
});
export type RmtcRowInput = z.input<typeof rowSchema>;

/// Heat No identifies a mill melt batch; the same heat can legitimately
/// supply more than one part, but reusing it twice for the SAME part is a
/// traceability error (ambiguous which lot a given heat no refers to).
async function assertHeatNoUniquePerPart(partId: string, heatNo: string, excludeRowId: string | undefined) {
  const conflict = await prisma.rmtcReportRow.findFirst({
    where: {
      heatNo,
      ...(excludeRowId ? { id: { not: excludeRowId } } : {}),
      rmtcReportDetail: { ppapElement: { ppap: { partRevision: { partId } } } },
    },
    select: { slNo: true },
  });
  if (conflict) {
    throw new Error(`Heat No "${heatNo}" is already used by lot #${conflict.slNo} for this part.`);
  }
}

export async function upsertRmtcRow(ppapElementId: string, input: RmtcRowInput) {
  const element = await assertEditable(ppapElementId);
  const data = rowSchema.parse(input);

  if (data.heatNo) {
    const partId = await getPartId(element.ppapId);
    await assertHeatNoUniquePerPart(partId, data.heatNo, data.id);
  }

  const qty = data.qtyNos?.trim();
  const rowData = {
    slNo: data.slNo || "",
    partNo: data.partNo || null,
    materialSpecId: data.materialSpecId || null,
    requiredSizeText: data.requiredSizeText || null,
    qtyNos: qty && Number.isFinite(Number(qty)) ? Number(qty) : null,
    observedSizeText: data.observedSizeText || null,
    millTcNo: data.millTcNo || null,
    millTcDate: dateOrNull(data.millTcDate),
    heatNo: data.heatNo || null,
    plateNo: data.plateNo || null,
    materialIdNo: data.materialIdNo || null,
    labReportNo: data.labReportNo || null,
    remarks: data.remarks || null,
  };

  if (data.id) {
    await prisma.rmtcReportRow.update({ where: { id: data.id }, data: rowData });
  } else {
    const detail = await getOrCreateDetail(ppapElementId);
    const count = await prisma.rmtcReportRow.count({ where: { rmtcReportDetailId: detail.id } });
    const defaultMaterialSpecId = rowData.materialSpecId ?? (await getDefaultMaterialSpecId(element.ppapId));
    await prisma.rmtcReportRow.create({
      data: { ...rowData, materialSpecId: defaultMaterialSpecId, rmtcReportDetailId: detail.id, sortOrder: count },
    });
  }

  revalidateRmtc(element.ppapId);
}

export async function deleteRmtcRow(rowId: string, ppapElementId: string) {
  const element = await assertEditable(ppapElementId);
  await prisma.rmtcReportRow.delete({ where: { id: rowId } });
  revalidateRmtc(element.ppapId);
}

export async function moveRmtcRow(rowId: string, ppapElementId: string, direction: "up" | "down") {
  const element = await assertEditable(ppapElementId);

  const row = await prisma.rmtcReportRow.findUniqueOrThrow({ where: { id: rowId } });
  const all = await prisma.rmtcReportRow.findMany({
    where: { rmtcReportDetailId: row.rmtcReportDetailId },
    orderBy: { sortOrder: "asc" },
  });
  const index = all.findIndex((r) => r.id === rowId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= all.length) return;

  const a = all[index];
  const b = all[swapIndex];
  await prisma.$transaction([
    prisma.rmtcReportRow.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
    prisma.rmtcReportRow.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
  ]);

  revalidateRmtc(element.ppapId);
}

// ---------------------------------------------------------------------------
// MTC PDF upload (per row)
// ---------------------------------------------------------------------------

export async function uploadMtcFile(rowId: string, ppapElementId: string, formData: FormData) {
  const element = await assertEditable(ppapElementId);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("A file is required");
  }

  const saved = await saveUploadedFile(file, `ppap-elements/${ppapElementId}/rmtc`);
  await prisma.rmtcReportRow.update({
    where: { id: rowId },
    data: { mtcFileUrl: saved.url, mtcFileName: saved.fileName, mtcFileType: saved.fileType },
  });

  revalidateRmtc(element.ppapId);
}

// ---------------------------------------------------------------------------
// Excel import
// ---------------------------------------------------------------------------

export async function importRmtcExcel(ppapElementId: string, formData: FormData) {
  const element = await assertEditable(ppapElementId);

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    throw new Error("Select a file to import.");
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const result = await importRmtcWorkbook(workbook, ppapElementId);
  revalidateRmtc(element.ppapId);
  return result;
}

// ---------------------------------------------------------------------------
// Heat No traceability search (heat no -> lots -> lab reports, across PPAPs)
// ---------------------------------------------------------------------------

export async function searchByHeatNo(heatNo: string) {
  const query = heatNo.trim();
  if (!query) return [];

  const rows = await prisma.rmtcReportRow.findMany({
    where: { heatNo: { contains: query, mode: "insensitive" } },
    include: {
      rmtcReportDetail: {
        include: {
          ppapElement: {
            include: {
              ppap: { include: { customer: true, partRevision: { include: { part: true } } } },
            },
          },
        },
      },
    },
    take: 50,
    orderBy: { updatedAt: "desc" },
  });

  return rows.map((r) => ({
    rowId: r.id,
    heatNo: r.heatNo,
    slNo: r.slNo,
    labReportNo: r.labReportNo,
    plateNo: r.plateNo,
    ppapId: r.rmtcReportDetail.ppapElement.ppapId,
    customerName: r.rmtcReportDetail.ppapElement.ppap.customer.name,
    partNumber: r.rmtcReportDetail.ppapElement.ppap.partRevision.part.partNumber,
    revision: r.rmtcReportDetail.ppapElement.ppap.partRevision.revision,
  }));
}
