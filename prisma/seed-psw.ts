import { prisma } from "../lib/prisma";

/**
 * Element 18 (PSW) values transcribed from sheet "18. PSW": Safety/Gov.
 * Regulation "Yes", checking aid "-" at ECL H dated 16-09-2025, reason
 * "Initial submission", results meet requirements "YES", print name /
 * title / phone of Santhosh BG. The sheet's ECL date (16-09-2025) is also
 * set on the part revision if it's missing — it's master data.
 *
 * Deliberately NOT signed: the sheet shows a filled-in warrant, but in the
 * app signing must pass the readiness gate (every required element
 * approved), which the seeded sample doesn't yet. Only fills an empty PSW.
 */
export async function seedPswFromReferenceSheet(ppapId: string) {
  const ppap = await prisma.ppap.findUniqueOrThrow({ where: { id: ppapId }, include: { partRevision: true } });
  const eclDate = new Date("2025-09-16T00:00:00.000Z");
  if (!ppap.partRevision.eclDate) {
    await prisma.partRevision.update({ where: { id: ppap.partRevisionId }, data: { eclDate } });
  }
  const element = await prisma.ppapElement.findUniqueOrThrow({ where: { ppapId_elementNo: { ppapId, elementNo: 18 } } });
  if (await prisma.pswDetail.findUnique({ where: { ppapElementId: element.id } })) return false;
  await prisma.pswDetail.create({
    data: {
      ppapElementId: element.id,
      safetyGovRegulation: true,
      checkingAidNo: "-",
      checkingAidEcl: "H",
      checkingAidEclDate: eclDate,
      reasons: ["INITIAL_SUBMISSION"],
      resultsMeetRequirements: true,
      printName: "Santhosh BG",
      title: "Manager QA",
      phone: "9449116311",
    },
  });
  return true;
}
