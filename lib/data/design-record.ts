import { prisma } from "@/lib/prisma";

/**
 * The balloon list entered on the Design Record page (element 1) is the
 * source of truth for the Dimensional Report (element 9) — see the Page 1
 * and Page 9 prompts in CLAUDE.md history. Looks up element 1 for the given
 * PPAP and returns its balloons in balloon-number order.
 */
export async function getBalloonsForPpap(ppapId: string) {
  const designRecordElement = await prisma.ppapElement.findUnique({
    where: { ppapId_elementNo: { ppapId, elementNo: 1 } },
    include: { balloons: { orderBy: { balloonNo: "asc" } } },
  });

  return designRecordElement?.balloons ?? [];
}

/**
 * The Design Record's material spec (element 1) is the default material
 * for every new row on the RM Test Reports grid (element 10) — see the
 * Page 10 prompt in CLAUDE.md history.
 */
export async function getDefaultMaterialSpecId(ppapId: string): Promise<string | null> {
  const designRecordElement = await prisma.ppapElement.findUnique({
    where: { ppapId_elementNo: { ppapId, elementNo: 1 } },
    include: { designRecordDetail: true },
  });

  return designRecordElement?.designRecordDetail?.materialSpecId ?? null;
}
