import { prisma } from "@/lib/prisma";
import { AAR_DEFAULT_ROWS, formatLabPaintResult, type AarPaintProperty } from "@/lib/calc/aar";
import { getAarCriteriaForPpap } from "@/lib/csr";

/**
 * Element 13 (AAR) server helpers shared by the page, print view, Excel
 * export and actions.
 */

/**
 * Formatted latest Lab Report (element 12) paint result per property, from
 * the most recent report that has a result for it.
 */
export async function getLabPaintResultsForPpap(ppapId: string): Promise<Partial<Record<AarPaintProperty, string>>> {
  const labElement = await prisma.ppapElement.findUnique({ where: { ppapId_elementNo: { ppapId, elementNo: 12 } } });
  if (!labElement) return {};
  const reports = await prisma.labReport.findMany({
    where: { ppapElementId: labElement.id },
    orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
    include: { paintResults: true },
  });

  const out: Partial<Record<AarPaintProperty, string>> = {};
  for (const property of ["DFT", "ADHESION", "GLOSS"] as const) {
    for (const report of reports) {
      const paint = report.paintResults.find((p) => p.property === property);
      const formatted = paint ? formatLabPaintResult({ ...paint, reportNo: report.reportNo }) : null;
      if (formatted) {
        out[property] = formatted;
        break;
      }
    }
  }
  return out;
}

/**
 * Creates the 8 sheet rows the first time an AAR is opened: acceptance
 * criteria / evaluation method from the customer's CSR zone A (element
 * 17) where it states them, DFT / adhesion / gloss results from Lab
 * Reports (element 12) when available. No-op once any row exists, so
 * deleted or edited rows stay as the user left them.
 */
export async function ensureAarCriteriaRows(ppapElementId: string, ppapId: string) {
  const count = await prisma.aarCriteriaRow.count({ where: { ppapElementId } });
  if (count > 0) return;
  const [lab, csr] = await Promise.all([getLabPaintResultsForPpap(ppapId), getAarCriteriaForPpap(ppapId)]);
  await prisma.aarCriteriaRow.createMany({
    data: AAR_DEFAULT_ROWS.map((row, i) => ({
      ppapElementId,
      sortOrder: i,
      parameter: row.parameter,
      specification: row.specification,
      evaluationMethod: csr[row.parameter]?.evaluationMethod ?? row.evaluationMethod,
      acceptanceCriteria: csr[row.parameter]?.acceptanceCriteria ?? row.acceptanceCriteria,
      labPaintProperty: row.labPaintProperty,
      result: row.labPaintProperty ? (lab[row.labPaintProperty] ?? null) : null,
    })),
  });
}

/** The single supplier record (Ingenious Engineering) — there's no per-PPAP supplier FK. */
export async function getSupplierForHeader() {
  const supplier = await prisma.supplier.findFirst({ orderBy: { createdAt: "asc" } });
  return { name: supplier?.name ?? "Ingenious Engineering Pvt Ltd", code: supplier?.supplierCode ?? null };
}
