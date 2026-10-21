import { prisma } from "@/lib/prisma";
import { pswReadiness, submissionResults, reasonFromText } from "@/lib/calc/psw";

/**
 * Element 18 (PSW): everything the warrant shows, assembled from master
 * data and the other elements — only PswDetail is entered on the page.
 * Shared by the page, the print view and the sign action.
 */
export async function getPswView(ppapId: string) {
  const ppap = await prisma.ppap.findUniqueOrThrow({
    where: { id: ppapId },
    include: { customer: true, partRevision: { include: { part: true } }, elements: { orderBy: { elementNo: "asc" } } },
  });
  const element = ppap.elements.find((e) => e.elementNo === 18)!;
  const part = ppap.partRevision.part;

  const [detail, supplier, ecns, fixtures, disposition] = await Promise.all([
    prisma.pswDetail.findUnique({ where: { ppapElementId: element.id }, include: { signedBy: true } }),
    prisma.supplier.findFirst({ orderBy: { createdAt: "asc" } }),
    // Additional engineering changes: approved ECNs logged against any revision of this part.
    prisma.ecnRecord.findMany({
      where: { status: "APPROVED", ppapElement: { ppap: { partRevision: { partId: part.id } } } },
      orderBy: { ecnDate: "asc" },
      select: { id: true, ecnNumber: true, ecnDate: true, proposedChange: true },
    }),
    prisma.fixture.findMany({ where: { partId: part.id, status: { not: "RETIRED" } }, orderBy: { code: "asc" } }),
    prisma.customerDisposition.findUnique({ where: { ppapElementId: element.id }, include: { recordedBy: true } }),
  ]);

  const gate = pswReadiness(ppap.elements);
  const results = submissionResults(ppap.elements);
  const defaultReason = reasonFromText(ppap.reasonForSubmission);

  return {
    ppap,
    element,
    disposition,
    detail,
    // What the form starts from when nothing is saved yet.
    defaults: {
      reasons: detail?.reasons.length ? detail.reasons : defaultReason ? [defaultReason] : [],
      checkingAidNo: detail?.checkingAidNo ?? (fixtures.length ? fixtures.map((f) => f.code).join(", ") : null),
    },
    partInfo: {
      partName: part.partName,
      customerPartNumber: `${part.partNumber} (${ppap.partRevision.revision})`,
      ecl: ppap.partRevision.revision,
      eclDate: ppap.partRevision.eclDate,
      drawingNo: ppap.partRevision.drawingNo ?? part.partNumber,
      weightKg: part.weightKg ? Number(part.weightKg) : null,
      additionalChanges: ecns,
    },
    supplierInfo: {
      name: supplier?.name ?? "Ingenious Engineering Pvt Ltd",
      code: supplier?.supplierCode ?? null,
      street: [supplier?.addressLine1, supplier?.addressLine2].filter(Boolean).join(", ") || null,
      city: supplier?.city ?? null,
      stateCountry: supplier?.state ? `${supplier.state}, India` : null,
      zip: supplier?.zip ?? null,
    },
    submissionInfo: {
      customerDivision: [ppap.customer.name, ppap.customer.division].filter(Boolean).join(" / "),
      buyer: [ppap.customer.buyerName, ppap.customer.buyerCode].filter(Boolean).join(" / ") || null,
      application: part.application,
    },
    level: ppap.level,
    gate,
    results,
  };
}
