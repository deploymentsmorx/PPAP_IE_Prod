import { prisma } from "@/lib/prisma";

/**
 * PPAP lifecycle rules driven by the PSW (element 18) and shared by the
 * actions that would otherwise let a closed PPAP change.
 */

/** Refuses changes to a PPAP the customer has closed by approving its PSW. */
export async function assertPpapOpen(ppapId: string) {
  const ppap = await prisma.ppap.findUniqueOrThrow({ where: { id: ppapId }, select: { status: true } });
  if (ppap.status === "CLOSED") throw new Error("This PPAP is closed — the customer approved the PSW. No further changes.");
}

/**
 * Customer disposition of the PSW (called from saveCustomerDisposition):
 *  - requires the supplier's signature first;
 *  - APPROVED → PSW CUSTOMER_APPROVED, PPAP CLOSED;
 *  - REJECTED → comments required; PSW CUSTOMER_REJECTED, signature
 *    cleared (must be re-signed), PPAP back to OPEN with the comments;
 *  - Other (CONDITIONAL) → stays SUBMITTED, comments recorded.
 * Returns the PSW element's new status.
 */
export async function applyPswDisposition(ppapElementId: string, status: "APPROVED" | "REJECTED" | "CONDITIONAL" | null, comments: string | null) {
  const element = await prisma.ppapElement.findUniqueOrThrow({ where: { id: ppapElementId }, include: { pswDetail: true } });
  if (!element.pswDetail?.signedAt) throw new Error("The supplier must sign the PSW before the customer can disposition it.");
  const now = new Date();
  if (status === "APPROVED") {
    await prisma.ppap.update({ where: { id: element.ppapId }, data: { status: "CLOSED", statusChangedAt: now, lastRejectionComments: null } });
    return "CUSTOMER_APPROVED" as const;
  }
  if (status === "REJECTED") {
    if (!comments?.trim()) throw new Error("Rejecting the PSW requires comments explaining what must be corrected.");
    await prisma.pswDetail.update({ where: { id: element.pswDetail.id }, data: { signedById: null, signedAt: null } });
    await prisma.ppap.update({ where: { id: element.ppapId }, data: { status: "OPEN", statusChangedAt: now, lastRejectionComments: comments.trim() } });
    return "CUSTOMER_REJECTED" as const;
  }
  return "SUBMITTED" as const;
}
