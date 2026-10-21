import { prisma } from "@/lib/prisma";
import type { Applicability } from "@/app/generated/prisma/client";

/**
 * Generates the 19 PpapElement rows for a PPAP from the AIAG
 * level-applicability matrix. CUSTOMER_DECIDES resolves to NA with a
 * "customer to confirm" note — same convention used by the seed script.
 * Shared by the New PPAP flow and Clone-to-new-revision (ECN approval).
 */
export async function createPpapElements(ppapId: string, level: number) {
  const rules = await prisma.levelApplicabilityRule.findMany({ where: { level } });
  const ruleByElement = new Map(rules.map((r) => [r.elementNo, r.rule]));

  for (let elementNo = 0; elementNo <= 18; elementNo++) {
    const rule = ruleByElement.get(elementNo) ?? "NA";
    const applicability: Applicability = rule === "CUSTOMER_DECIDES" ? "NA" : rule;
    const naReason = rule === "CUSTOMER_DECIDES" ? "Customer to confirm applicability for this level" : null;

    await prisma.ppapElement.create({
      data: { ppapId, elementNo, applicability, naReason, status: "NOT_STARTED" },
    });
  }
}
