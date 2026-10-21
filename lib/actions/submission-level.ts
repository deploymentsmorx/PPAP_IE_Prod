"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertSupplierUser } from "@/lib/permissions";
import { submissionLevel, submissionLevelErrors, PSW_ELEMENT_NO } from "@/lib/calc/submission-level";

const schema = z.object({
  level: z.number().int().min(1).max(5),
  elementNos: z.array(z.number().int().min(0).max(17)),
});

const PSW_LOCKED = new Set(["APPROVED", "SUBMITTED", "CUSTOMER_APPROVED"]);

/**
 * Saves the final submission level (pack page) as the PPAP's level — the PSW
 * ticks it as "Requested Submission Level" — plus the supporting documents
 * picked for level 2 / 4. Element applicability is not touched. Fixed once
 * the PSW is approved or signed, since it is printed on the PSW.
 */
export async function setSubmissionLevel(ppapId: string, input: { level: number; elementNos: number[] }) {
  const user = await assertSupplierUser();
  const { level, elementNos } = schema.parse(input);
  const picks = [...new Set(elementNos)].sort((a, b) => a - b);
  const errors = submissionLevelErrors(level, picks);
  if (errors.length) throw new Error(errors.join(" "));

  const ppap = await prisma.ppap.findUniqueOrThrow({
    where: { id: ppapId },
    select: { status: true, level: true, submissionElementNos: true, submissionLevelSetAt: true, elements: { where: { elementNo: PSW_ELEMENT_NO }, select: { status: true } } },
  });
  if (ppap.status !== "OPEN" || PSW_LOCKED.has(ppap.elements[0]?.status ?? "")) {
    throw new Error("The submission level is fixed once the PSW is approved or signed — it is printed on the PSW.");
  }

  const after = await prisma.ppap.update({
    where: { id: ppapId },
    // Levels 1/3/5 keep the earlier picks, so switching back to 2/4 restores them.
    data: { level, submissionLevelSetAt: new Date(), ...(submissionLevel(level)!.picks ? { submissionElementNos: picks } : {}) },
  });
  await prisma.auditLog.create({
    data: {
      ppapId,
      userId: user.id,
      action: "UPDATE",
      entityType: "Ppap",
      entityId: ppapId,
      before: { level: ppap.level, submissionElementNos: ppap.submissionElementNos, submissionLevelSetAt: ppap.submissionLevelSetAt },
      after: { level: after.level, submissionElementNos: after.submissionElementNos, submissionLevelSetAt: after.submissionLevelSetAt },
    },
  });

  revalidatePath(`/ppap/${ppapId}`, "layout");
  revalidatePath("/");
}
