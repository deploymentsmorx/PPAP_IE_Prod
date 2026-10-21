import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * These write through to the shared master records (Part, Customer,
 * PartRevision) rather than a page-local copy — per CLAUDE.md, "never
 * duplicate master data". Editing them from any one PPAP's page affects
 * every other PPAP that references the same part/customer/revision.
 */

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export async function updatePartMaster(partId: string, data: { partName: string; partNumber: string }) {
  try {
    await prisma.part.update({ where: { id: partId }, data });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new Error("Another part for this customer already uses that part number.");
    }
    throw err;
  }
}

export async function updateCustomerName(customerId: string, name: string) {
  await prisma.customer.update({ where: { id: customerId }, data: { name } });
}

export async function updatePartRevisionMaster(
  partRevisionId: string,
  data: { drawingNo: string; revision: string },
) {
  try {
    await prisma.partRevision.update({ where: { id: partRevisionId }, data });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new Error("Another revision of this part already uses that revision label.");
    }
    throw err;
  }
}
