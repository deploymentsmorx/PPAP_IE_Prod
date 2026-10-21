import { prisma } from "@/lib/prisma";
import { masterSampleExpiry, expiryState, daysUntil } from "@/lib/calc/master-sample";

/**
 * Element 15 (Master Sample) server helpers shared by the page, print,
 * export, dashboard and the sign-off workflow.
 */

/**
 * Auto-supersede: once element 15 of `ppapId` is approved and has at least
 * one ACTIVE master sample, every ACTIVE master sample on an *older*
 * revision of the same part (any PPAP) becomes SUPERSEDED. Called from
 * updateElementSignatures. Returns the superseded rows' ids.
 */
export async function supersedeOlderMasterSamples(ppapId: string, userId: string | null): Promise<string[]> {
  const ppap = await prisma.ppap.findUniqueOrThrow({ where: { id: ppapId }, include: { partRevision: true } });
  const element = await prisma.ppapElement.findUniqueOrThrow({ where: { ppapId_elementNo: { ppapId, elementNo: 15 } } });
  const activeHere = await prisma.masterSample.count({ where: { ppapElementId: element.id, status: "ACTIVE" } });
  if (activeHere === 0) return [];

  const olderRevisions = await prisma.partRevision.findMany({
    where: { partId: ppap.partRevision.partId, id: { not: ppap.partRevisionId }, createdAt: { lt: ppap.partRevision.createdAt } },
    select: { id: true },
  });
  if (olderRevisions.length === 0) return [];

  const toSupersede = await prisma.masterSample.findMany({
    where: {
      status: "ACTIVE",
      ppapElement: { elementNo: 15, ppap: { partRevisionId: { in: olderRevisions.map((r) => r.id) } } },
    },
    include: { ppapElement: { select: { ppapId: true } } },
  });

  const now = new Date();
  for (const row of toSupersede) {
    const { ppapElement, ...before } = row;
    const after = await prisma.masterSample.update({
      where: { id: row.id },
      data: { status: "SUPERSEDED", supersededAt: now, supersededByPpapId: ppapId },
    });
    await prisma.auditLog.create({
      data: {
        ppapId: ppapElement.ppapId,
        userId,
        action: "UPDATE",
        entityType: "MasterSample",
        entityId: row.id,
        before: before as never,
        after: { ...after, reason: `Auto-superseded: master sample approved on newer revision (PPAP ${ppapId})` } as never,
      },
    });
  }
  return toSupersede.map((r) => r.id);
}

/** Master samples of the same part on other revisions — shown as history on element 15. */
export async function getOtherRevisionMasterSamples(ppapId: string) {
  const ppap = await prisma.ppap.findUniqueOrThrow({ where: { id: ppapId }, include: { partRevision: true } });
  const rows = await prisma.masterSample.findMany({
    where: {
      ppapElement: {
        elementNo: 15,
        ppapId: { not: ppapId },
        ppap: { partRevision: { partId: ppap.partRevision.partId } },
      },
    },
    include: { ppapElement: { include: { ppap: { include: { partRevision: true } } } } },
    orderBy: [{ createdAt: "desc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    sampleId: r.sampleId,
    ppapId: r.ppapElement.ppapId,
    revision: r.ppapElement.ppap.partRevision.revision,
    approvalDate: r.approvalDate,
    expiry: masterSampleExpiry(r.approvalDate, r.retentionYears),
    status: r.status,
    supersededAt: r.supersededAt,
  }));
}

/**
 * Dashboard reminder: ACTIVE master samples (any PPAP) expiring within the
 * 30-day window, or already expired.
 */
export async function getMasterSampleExpiryReminders(today: Date = new Date()) {
  const rows = await prisma.masterSample.findMany({
    where: { status: "ACTIVE", approvalDate: { not: null }, retentionYears: { not: null } },
    include: { ppapElement: { include: { ppap: { include: { partRevision: { include: { part: true } } } } } } },
  });
  return rows
    .map((r) => {
      const expiry = masterSampleExpiry(r.approvalDate, r.retentionYears)!;
      return {
        id: r.id,
        sampleId: r.sampleId,
        ppapId: r.ppapElement.ppapId,
        partName: r.ppapElement.ppap.partRevision.part.partName,
        partNumber: r.ppapElement.ppap.partRevision.part.partNumber,
        revision: r.ppapElement.ppap.partRevision.revision,
        storageLocation: r.storageLocation,
        expiry,
        state: expiryState(expiry, today)!,
        days: daysUntil(expiry, today),
      };
    })
    .filter((r) => r.state !== "OK")
    .sort((a, b) => a.days - b.days);
}
