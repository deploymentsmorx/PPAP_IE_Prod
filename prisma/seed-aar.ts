import { prisma } from "../lib/prisma";
import { ensureAarCriteriaRows } from "../lib/aar";

/**
 * Element 13 (AAR) values transcribed from the reference sheet "13. AAR":
 * header date 16-09-2025, New Part ticked, sample 2Nos / 2Nos evaluated,
 * samples NBL-01 & NBL-02, Prototype ticked, Reviewed By Rajesh Goel (no
 * date on the sheet). The 8 criteria rows are the sheet's own; its Result
 * column, master sample reference and evaluation summary are blank on the
 * sheet, so they're left blank rather than invented. Only fills an AAR
 * that has no detail yet, so it never overwrites edits made in the app.
 */
export async function seedAarFromReferenceSheet(ppapId: string, reviewerId: string) {
  const element = await prisma.ppapElement.findUniqueOrThrow({ where: { ppapId_elementNo: { ppapId, elementNo: 13 } } });
  await ensureAarCriteriaRows(element.id, ppapId);

  const existing = await prisma.aarDetail.findUnique({ where: { ppapElementId: element.id } });
  if (existing) return false;

  await prisma.aarDetail.create({
    data: {
      ppapElementId: element.id,
      reportDate: new Date("2025-09-16T00:00:00.000Z"),
      submissionReason: "NEW_PART",
      sampleSize: "2Nos",
      samplesEvaluated: "2Nos",
      sampleIds: "NBL-01, NBL-02",
      productionCondition: "PROTOTYPE",
    },
  });
  if (!element.checkedById) {
    await prisma.ppapElement.update({ where: { id: element.id }, data: { checkedById: reviewerId } });
  }
  return true;
}
