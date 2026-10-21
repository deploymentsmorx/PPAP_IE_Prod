import { prisma } from "@/lib/prisma";
import { extractZoneCriteria, aarCriteriaFromCsr, type ZoneCriteria } from "@/lib/calc/csr";

/**
 * Element 17 (CSR) server helpers. The CSR library is per customer; zone
 * maps and compliance are per PPAP (element 17).
 */

export async function getCsrLibrary(customerId: string) {
  return prisma.csrSection.findMany({
    where: { customerId },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    include: { requirements: { orderBy: [{ sortOrder: "asc" }, { ruleNo: "asc" }] } },
  });
}

/**
 * Zone criteria for a customer — the payload of GET
 * /api/csr/[customerId]/zones, also used by AAR (element 13).
 */
export async function getZoneCriteriaForCustomer(customerId: string) {
  const sections = await getCsrLibrary(customerId);
  const zones = sections
    .filter((s) => s.isZone)
    .map((s) => ({
      code: s.code,
      title: s.title,
      description: s.description,
      colour: s.colour,
      requirements: s.requirements.map((r) => ({ ruleNo: r.ruleNo, text: r.text, criteriaKey: r.criteriaKey })),
      criteria: extractZoneCriteria(s.requirements) as ZoneCriteria,
    }));
  return { customerId, zones };
}

/** AAR parameter → acceptance criteria / evaluation method from the customer's CSR zone A. */
export async function getAarCriteriaForPpap(ppapId: string) {
  const ppap = await prisma.ppap.findUniqueOrThrow({ where: { id: ppapId }, select: { customerId: true } });
  const { zones } = await getZoneCriteriaForCustomer(ppap.customerId);
  return aarCriteriaFromCsr(zones.find((z) => z.code === "A")?.criteria ?? null);
}

/** One compliance row per library requirement for this PPAP (new requirements appear as "not assessed"). */
export async function ensureCsrCompliances(ppapElementId: string, customerId: string) {
  const requirements = await prisma.csrRequirement.findMany({ where: { section: { customerId } }, select: { id: true } });
  if (requirements.length === 0) return;
  await prisma.csrCompliance.createMany({
    data: requirements.map((r) => ({ ppapElementId, requirementId: r.id })),
    skipDuplicates: true,
  });
}

/** Element 17's library + compliance rows, grouped by section, in library order. */
export async function getCsrComplianceView(ppapId: string) {
  const ppap = await prisma.ppap.findUniqueOrThrow({ where: { id: ppapId }, include: { customer: true } });
  const element = await prisma.ppapElement.findUniqueOrThrow({ where: { ppapId_elementNo: { ppapId, elementNo: 17 } } });
  await ensureCsrCompliances(element.id, ppap.customerId);
  const [sections, compliances] = await Promise.all([
    getCsrLibrary(ppap.customerId),
    prisma.csrCompliance.findMany({ where: { ppapElementId: element.id } }),
  ]);
  const byRequirement = new Map(compliances.map((c) => [c.requirementId, c]));
  return {
    customer: ppap.customer,
    element,
    sections: sections.map((s) => ({
      ...s,
      requirements: s.requirements.map((r) => ({ ...r, compliance: byRequirement.get(r.id)! })),
    })),
  };
}
