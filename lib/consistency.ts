import { prisma } from "@/lib/prisma";
import { calculateActionPriority, parseApText } from "@/lib/calc/ap";
import { parseDimensionAndTolerance, computeStatus } from "@/lib/calc/tolerance";
import { submissionResults } from "@/lib/calc/psw";
import { checkDateOrder, checkOwnership, checkApplicability, checkTypedValues, type Issue } from "@/lib/calc/consistency";

const DONE = new Set(["APPROVED", "SUBMITTED", "CUSTOMER_APPROVED"]);

/**
 * Runs every pre-submission check for a PPAP (see lib/calc/consistency.ts)
 * against the database. ERRORs block signing the PSW.
 */
export async function runConsistencyChecks(ppapId: string): Promise<Issue[]> {
  const elements = await prisma.ppapElement.findMany({ where: { ppapId }, orderBy: { elementNo: "asc" } });
  const id = (n: number) => elements.find((e) => e.elementNo === n)!.id;
  const notThisPpap = { ppapId: { not: ppapId } };

  const sum = async (...qs: Promise<number>[]) => (await Promise.all(qs)).reduce((a, b) => a + b, 0);

  // Everything below is independent — one parallel batch instead of ~35 sequential database round-trips.
  const [psw, foreignCounts, pageCounts, checklist, pfmeaRows, dimRows] = await Promise.all([
    prisma.pswDetail.findUnique({ where: { ppapElementId: id(18) } }),

    // ---- Data belonging to another part revision / PPAP ----
    Promise.all([
      prisma.spcStudy.count({ where: { ppapElementId: id(11), specialCharacteristic: { ppapElement: notThisPpap } } }),
      prisma.msaStudy.count({ where: { ppapElementId: id(8), controlPlanRow: { controlPlanDetail: { ppapElement: notThisPpap } } } }),
      prisma.dimensionalReportRow.count({ where: { dimensionalReportDetail: { ppapElementId: id(9) }, balloon: { ppapElement: notThisPpap } } }),
      prisma.controlPlanRow.count({ where: { controlPlanDetail: { ppapElementId: id(7) }, specialCharacteristic: { ppapElement: notThisPpap } } }),
      prisma.labReport.count({ where: { ppapElementId: id(12), rmtcReportRow: { rmtcReportDetail: { ppapElement: notThisPpap } } } }),
    ]),

    // ---- Which pages hold data (index = elementNo - 1) ----
    Promise.all([
      sum(
        prisma.designRecordDetail.count({ where: { ppapElementId: id(1) } }),
        prisma.drawingFile.count({ where: { ppapElementId: id(1) } }),
        prisma.balloon.count({ where: { ppapElementId: id(1) } }),
      ),
      prisma.ecnRecord.count({ where: { ppapElementId: id(2) } }),
      prisma.ceaDetail.count({ where: { ppapElementId: id(3) } }),
      prisma.dfmeaRow.count({ where: { dfmeaDetail: { ppapElementId: id(4) } } }),
      prisma.childPart.count({ where: { ppapElementId: id(5) } }),
      prisma.pfmeaRow.count({ where: { pfmeaProcessStep: { ppapElementId: id(6) } } }),
      prisma.controlPlanRow.count({ where: { controlPlanDetail: { ppapElementId: id(7) } } }),
      prisma.msaStudy.count({ where: { ppapElementId: id(8) } }),
      prisma.dimensionalReportRow.count({ where: { dimensionalReportDetail: { ppapElementId: id(9) } } }),
      prisma.rmtcReportRow.count({ where: { rmtcReportDetail: { ppapElementId: id(10) } } }),
      prisma.spcStudy.count({ where: { ppapElementId: id(11) } }),
      prisma.labReport.count({ where: { ppapElementId: id(12) } }),
      prisma.aarDetail.count({ where: { ppapElementId: id(13) } }),
      sum(prisma.sppDetail.count({ where: { ppapElementId: id(14) } }), prisma.sppSample.count({ where: { ppapElementId: id(14) } })),
      prisma.masterSample.count({ where: { ppapElementId: id(15) } }),
      sum(
        prisma.ppapCheckingAid.count({ where: { ppapElementId: id(16) } }),
        prisma.controlPlanRow.count({ where: { controlPlanDetail: { ppapElementId: id(7) }, instrumentId: { not: null } } }),
      ),
      sum(
        prisma.csrCompliance.count({ where: { ppapElementId: id(17), complied: { not: null } } }),
        prisma.csrZoneMapPage.count({ where: { ppapElementId: id(17) } }),
      ),
    ]),

    prisma.checklistRow.findMany({ where: { ppapId } }),

    // ---- Typed vs computed ----
    prisma.pfmeaRow.findMany({
      where: { pfmeaProcessStep: { ppapElementId: id(6) } },
      select: { severity: true, occurrence: true, detection: true, importedApText: true, revisedSeverity: true, revisedOccurrence: true, revisedDetection: true, importedRevisedApText: true },
    }),
    prisma.dimensionalReportRow.findMany({
      where: { dimensionalReportDetail: { ppapElementId: id(9) } },
      select: { designDimensionText: true, toleranceText: true, remarks: true, readings: { select: { value: true } } },
    }),
  ]);

  const foreign = [
    { elementNo: 11, what: "SPC studies", count: foreignCounts[0] },
    { elementNo: 8, what: "MSA studies", count: foreignCounts[1] },
    { elementNo: 9, what: "dimensional rows", count: foreignCounts[2] },
    { elementNo: 7, what: "Control Plan rows", count: foreignCounts[3] },
    { elementNo: 12, what: "lab reports", count: foreignCounts[4] },
  ];
  const counts: Record<number, number> = Object.fromEntries(pageCounts.map((c, i) => [i + 1, c]));
  const checklistByNo = new Map(checklist.map((c) => [c.elementNo, c]));
  let pfmeaApMismatches = 0;
  for (const r of pfmeaRows) {
    const typed = parseApText(r.importedApText);
    if (typed && r.severity && r.occurrence && r.detection && typed !== calculateActionPriority(r.severity, r.occurrence, r.detection)) pfmeaApMismatches++;
    const typedRev = parseApText(r.importedRevisedApText);
    if (typedRev && r.revisedSeverity && r.revisedOccurrence && r.revisedDetection && typedRev !== calculateActionPriority(r.revisedSeverity, r.revisedOccurrence, r.revisedDetection)) {
      pfmeaApMismatches++;
    }
  }

  let dimensionalNg = 0;
  let dimensionalRemarkMismatches = 0;
  for (const r of dimRows) {
    const parsed = parseDimensionAndTolerance(r.designDimensionText, r.toleranceText);
    const values = r.readings.map((x) => x.value).filter((v): v is number => v !== null);
    if (!parsed || values.length === 0) continue;
    const status = values.some((v) => computeStatus(v, parsed) === "NG") ? "NG" : "OK";
    if (status === "NG") dimensionalNg++;
    const typed = r.remarks?.trim().toUpperCase();
    if ((typed === "OK" || typed === "NG") && typed !== status) dimensionalRemarkMismatches++;
  }

  const results = submissionResults(elements);
  const issues: Issue[] = [
    ...checkDateOrder(elements, psw?.signedAt ?? new Date()),
    ...checkOwnership(foreign),
    ...checkApplicability(
      elements.map((e) => ({ elementNo: e.elementNo, applicability: e.applicability, hasData: (counts[e.elementNo] ?? 0) > 0, checklistRequired: checklistByNo.get(e.elementNo)?.requiredOverride ?? null })),
    ),
    ...checkTypedValues({
      pfmeaApMismatches,
      checklistStatusOk: checklist
        .filter((c) => c.statusOverride?.trim().toUpperCase() === "OK")
        .map((c) => ({ elementNo: c.elementNo, approved: DONE.has(elements.find((e) => e.elementNo === c.elementNo)?.status ?? "") })),
      dimensionalRemarkMismatches,
      pswSaysMeets: psw?.resultsMeetRequirements ?? null,
      resultsAllTicked: Object.values(results).every((v) => v !== "NO"),
      dimensionalNg,
    }),
  ];
  return issues.sort((a, b) => (a.severity === b.severity ? (a.elementNo ?? 0) - (b.elementNo ?? 0) : a.severity === "ERROR" ? -1 : 1));
}
