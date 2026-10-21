import { prisma } from "@/lib/prisma";

/**
 * "Generate from PFC/PFMEA": pre-fills one Control Plan row per PFMEA
 * process step, using that step's current detection controls as the
 * starting control method. Matches existing rows by process step name so
 * a re-sync never overwrites what the user has already typed — it only
 * adds rows for steps that don't have one yet.
 */
export async function generateFromPfcPfmea(controlPlanElementId: string): Promise<{ added: number }> {
  const controlPlanElement = await prisma.ppapElement.findUniqueOrThrow({ where: { id: controlPlanElementId } });
  const pfmeaElement = await prisma.ppapElement.findUnique({
    where: { ppapId_elementNo: { ppapId: controlPlanElement.ppapId, elementNo: 6 } },
  });
  if (!pfmeaElement) {
    throw new Error("This PPAP has no PFMEA (element 6) to generate from.");
  }

  const steps = await prisma.pfmeaProcessStep.findMany({
    where: { ppapElementId: pfmeaElement.id },
    orderBy: { sortOrder: "asc" },
    include: { rows: true },
  });

  let detail = await prisma.controlPlanDetail.findUnique({ where: { ppapElementId: controlPlanElementId } });
  if (!detail) {
    detail = await prisma.controlPlanDetail.create({ data: { ppapElementId: controlPlanElementId } });
  }

  const existingRows = await prisma.controlPlanRow.findMany({ where: { controlPlanDetailId: detail.id } });
  const existingByProcessName = new Set(existingRows.map((r) => r.processNameOperation));
  const maxSortOrder = existingRows.reduce((m, r) => Math.max(m, r.sortOrder), -1);
  const maxStageNo = existingRows.reduce((m, r) => Math.max(m, r.stageNo ?? 0), 0);

  let added = 0;
  let nextSortOrder = maxSortOrder + 1;
  let nextStageNo = maxStageNo + 1;

  for (const step of steps) {
    if (existingByProcessName.has(step.name)) continue;

    const controlMethod = step.rows.find((r) => r.currentDetectionControls)?.currentDetectionControls ?? null;

    await prisma.controlPlanRow.create({
      data: {
        controlPlanDetailId: detail.id,
        processNameOperation: step.name,
        stageNo: nextStageNo++,
        controlMethod,
        sortOrder: nextSortOrder++,
      },
    });
    added++;
  }

  return { added };
}
