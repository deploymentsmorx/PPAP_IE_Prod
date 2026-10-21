import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checklistRequiredText } from "@/lib/calc/checklist";

/**
 * Two-way sync between a page's N/A state and its PPAP Checklist "Required"
 * cell (element 0), per CLAUDE.md. The other checklist columns stay
 * free-edit. Server-only helpers shared by lib/actions/na-toggle.ts and
 * lib/actions/checklist.ts.
 */

export const CHECKLIST_NA_REASON = "Not required per PPAP checklist";

/** Page → checklist: write "Y"/"N" into the element's Required cell. */
export async function writeChecklistRequired(ppapId: string, elementNo: number, applicability: "REQUIRED" | "RETAIN" | "NA") {
  const requiredOverride = checklistRequiredText(applicability);
  await prisma.checklistRow.upsert({
    where: { ppapId_elementNo: { ppapId, elementNo } },
    update: { requiredOverride },
    create: { ppapId, elementNo, requiredOverride },
  });
}

/**
 * Checklist → page: set an element N/A (with the checklist reason) or back
 * to REQUIRED, audit-logged. Callers skip APPROVED (locked) pages.
 */
export async function applyChecklistApplicability(elementId: string, target: "REQUIRED" | "NA") {
  const before = await prisma.ppapElement.findUniqueOrThrow({ where: { id: elementId } });
  const after = await prisma.ppapElement.update({
    where: { id: elementId },
    data: target === "NA" ? { applicability: "NA", naReason: CHECKLIST_NA_REASON } : { applicability: "REQUIRED", naReason: null },
  });
  const session = await auth();
  await prisma.auditLog.create({
    data: {
      ppapId: after.ppapId,
      userId: session?.user?.id ?? null,
      action: "UPDATE",
      entityType: "PpapElement",
      entityId: elementId,
      before: { applicability: before.applicability, naReason: before.naReason },
      after: { applicability: after.applicability, naReason: after.naReason, source: "PPAP checklist" },
    },
  });
  return after;
}
