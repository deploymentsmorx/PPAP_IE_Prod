"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { assertSupplierUser } from "@/lib/permissions";
import { importPfcWorkbook, ensureMainAssemblyRoute } from "@/lib/pfc-import";
import { deriveProcessStepList, type ProcessStep } from "@/lib/calc/process-flow";

async function assertEditable(ppapElementId: string) {
  await assertSupplierUser();
  const element = await prisma.ppapElement.findUniqueOrThrow({ where: { id: ppapElementId } });
  if (element.status === "APPROVED") {
    throw new Error("This page is approved and locked. Use Revise to edit it.");
  }
  return element;
}

function revalidatePfc(ppapId: string) {
  revalidatePath(`/ppap/${ppapId}/5`);
  revalidatePath(`/ppap/${ppapId}/5/print`);
  revalidatePath(`/ppap/${ppapId}`);
}

const childPartSchema = z.object({
  partNo: z.string().min(1),
  description: z.string().min(1),
  qtyPerAssembly: z.coerce.number().int().min(0),
  side: z.enum(["LEFT", "RIGHT"]),
  type: z.enum(["MAKE", "BOP"]),
  parentChildPartId: z.string().optional(),
});
export type ChildPartInput = z.input<typeof childPartSchema>;

export async function createChildPart(ppapElementId: string, input: ChildPartInput) {
  const element = await assertEditable(ppapElementId);
  const data = childPartSchema.parse(input);

  const maxItemNo = await prisma.childPart.aggregate({
    where: { ppapElementId },
    _max: { itemNo: true, sortOrder: true },
  });
  const itemNo = (maxItemNo._max.itemNo ?? 0) + 1;

  const childPart = await prisma.childPart.create({
    data: {
      ppapElementId,
      itemNo,
      partNo: data.partNo,
      description: data.description,
      qtyPerAssembly: data.qtyPerAssembly,
      side: data.side,
      type: data.type,
      parentChildPartId: data.parentChildPartId || null,
      sortOrder: (maxItemNo._max.sortOrder ?? 0) + 1,
    },
  });
  await prisma.route.create({ data: { ppapElementId, childPartId: childPart.id } });

  revalidatePfc(element.ppapId);
  return childPart;
}

export async function updateChildPart(childPartId: string, ppapElementId: string, input: ChildPartInput) {
  const element = await assertEditable(ppapElementId);
  const data = childPartSchema.parse(input);

  await prisma.childPart.update({
    where: { id: childPartId },
    data: {
      partNo: data.partNo,
      description: data.description,
      qtyPerAssembly: data.qtyPerAssembly,
      side: data.side,
      type: data.type,
      parentChildPartId: data.parentChildPartId || null,
    },
  });

  revalidatePfc(element.ppapId);
}

export async function deleteChildPart(childPartId: string, ppapElementId: string) {
  const element = await assertEditable(ppapElementId);

  const children = await prisma.childPart.count({ where: { parentChildPartId: childPartId } });
  if (children > 0) {
    throw new Error("Cannot delete a child part that has sub-parts. Delete or reassign them first.");
  }

  const route = await prisma.route.findUnique({ where: { childPartId } });
  if (route) {
    await prisma.routeStep.deleteMany({ where: { routeId: route.id } });
    await prisma.route.delete({ where: { id: route.id } });
  }
  await prisma.childPart.delete({ where: { id: childPartId } });

  revalidatePfc(element.ppapId);
}

export async function moveChildPart(childPartId: string, ppapElementId: string, direction: "up" | "down") {
  const element = await assertEditable(ppapElementId);

  const all = await prisma.childPart.findMany({ where: { ppapElementId }, orderBy: { sortOrder: "asc" } });
  const index = all.findIndex((c) => c.id === childPartId);
  if (index === -1) return;
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= all.length) return;

  const a = all[index];
  const b = all[swapIndex];
  await prisma.$transaction([
    prisma.childPart.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
    prisma.childPart.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
  ]);

  revalidatePfc(element.ppapId);
}

// ---------------------------------------------------------------------------
// Route steps
// ---------------------------------------------------------------------------

/// Adding a non-inspection operation auto-inserts an Inspection step right
/// after it (per spec); the user can remove it like any other step.
export async function addRouteStep(ppapElementId: string, routeId: string, operationId: string) {
  const element = await assertEditable(ppapElementId);

  const operation = await prisma.operation.findUniqueOrThrow({ where: { id: operationId } });
  const count = await prisma.routeStep.count({ where: { routeId } });

  await prisma.routeStep.create({ data: { routeId, operationId, sequence: count } });

  if (operation.symbol !== "INSPECTION") {
    const inspection = await prisma.operation.findFirst({ where: { symbol: "INSPECTION" } });
    if (inspection) {
      await prisma.routeStep.create({ data: { routeId, operationId: inspection.id, sequence: count + 1 } });
    }
  }

  revalidatePfc(element.ppapId);
}

export async function removeRouteStep(ppapElementId: string, stepId: string) {
  const element = await assertEditable(ppapElementId);

  const step = await prisma.routeStep.findUniqueOrThrow({ where: { id: stepId } });
  await prisma.routeStep.delete({ where: { id: stepId } });

  const remaining = await prisma.routeStep.findMany({
    where: { routeId: step.routeId },
    orderBy: { sequence: "asc" },
  });
  await prisma.$transaction(
    remaining.map((s, i) => prisma.routeStep.update({ where: { id: s.id }, data: { sequence: i } })),
  );

  revalidatePfc(element.ppapId);
}

export async function moveRouteStep(ppapElementId: string, stepId: string, direction: "up" | "down") {
  const element = await assertEditable(ppapElementId);

  const step = await prisma.routeStep.findUniqueOrThrow({ where: { id: stepId } });
  const all = await prisma.routeStep.findMany({ where: { routeId: step.routeId }, orderBy: { sequence: "asc" } });
  const index = all.findIndex((s) => s.id === stepId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= all.length) return;

  const a = all[index];
  const b = all[swapIndex];
  await prisma.$transaction([
    prisma.routeStep.update({ where: { id: a.id }, data: { sequence: b.sequence } }),
    prisma.routeStep.update({ where: { id: b.id }, data: { sequence: a.sequence } }),
  ]);

  revalidatePfc(element.ppapId);
}

export async function importPfcExcel(ppapElementId: string, formData: FormData) {
  const element = await assertEditable(ppapElementId);

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    throw new Error("Select a file to import.");
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const result = await importPfcWorkbook(workbook, ppapElementId);
  await ensureMainAssemblyRoute(ppapElementId);

  revalidatePfc(element.ppapId);
  return result;
}

/// Used by PFMEA (element 6) and Control Plan (element 7) to build their
/// row lists from this part's actual manufacturing process.
export async function getProcessStepList(ppapElementId: string): Promise<ProcessStep[]> {
  const routes = await prisma.route.findMany({
    where: { ppapElementId },
    include: { childPart: { select: { itemNo: true } }, steps: { include: { operation: true } } },
  });

  return deriveProcessStepList(
    routes.map((route) => ({
      childPartItemNo: route.childPart?.itemNo ?? null,
      steps: route.steps.map((s) => ({
        operationCode: s.operation.code,
        operationName: s.operation.name,
        symbol: s.operation.symbol,
        sequence: s.sequence,
      })),
    })),
  );
}

export async function updateRouteStepDetails(
  ppapElementId: string,
  stepId: string,
  input: { machine?: string; note?: string },
) {
  const element = await assertEditable(ppapElementId);
  await prisma.routeStep.update({
    where: { id: stepId },
    data: { machine: input.machine || null, note: input.note || null },
  });
  revalidatePfc(element.ppapId);
}
