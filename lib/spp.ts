import { prisma } from "@/lib/prisma";
import { formatDateIndia } from "@/lib/format";
import { getConformanceSummary } from "@/lib/actions/dimensional-report";
import { getStudyResults } from "@/lib/actions/msa";
import { getProcessStepList } from "@/lib/actions/pfc";
import { getSupplierForHeader } from "@/lib/aar";
import { calibrationStatus } from "@/lib/calc/calibration";
import { getDueSoonDays } from "@/lib/instruments";
import { computeNumericStatus } from "@/lib/calc/lab";
import { parseDimensionAndTolerance, computeStatus } from "@/lib/calc/tolerance";
import {
  completionText,
  specialProcesses,
  summarizeLabStatuses,
  pickKeyDimensionalRows,
  grrStatusText,
  type ResultStatus,
} from "@/lib/calc/spp";

/**
 * Element 14 (Sample Production Part): everything in sections 1, 3, 4, 5,
 * 7 and 8 is read from other pages at render time — never copied — so the
 * page, print view and Excel export always show current data. Each section
 * carries the source element number for its "from page N" link.
 */

const MECH_LABEL: Record<string, string> = { YIELD_STRENGTH: "Yield", UTS: "UTS", ELONGATION: "Elongation", HARDNESS: "Hardness", IMPACT: "Impact" };
const CHEM_LABEL: Record<string, string> = { C: "C", MN: "Mn", SI: "Si", S: "S", P: "P", CR: "Cr", NI: "Ni", MO: "Mo", OTHER: "Other" };
const AAR_RESULT_LABEL: Record<string, string> = { APPROVED: "Approved", CONDITIONALLY_APPROVED: "Conditionally approved", REJECTED: "Rejected" };
const DISPOSITION_LABEL: Record<string, string> = { APPROVED: "Approved", REJECTED: "Rejected", CONDITIONAL: "Conditional" };
const CALIBRATION_LABEL = { VALID: "Calibrated", DUE_SOON: "Due is near", OVERDUE: "Overdue", NOT_CALIBRATED: "Not calibrated" } as const;

export type SppReadOnlyData = Awaited<ReturnType<typeof getSppReadOnlyData>>;

export async function getSppReadOnlyData(ppapId: string) {
  const ppap = await prisma.ppap.findUniqueOrThrow({
    where: { id: ppapId },
    include: { customer: true, partRevision: { include: { part: { include: { materialSpec: true } } } } },
  });
  const elements = await prisma.ppapElement.findMany({ where: { ppapId } });
  const byNo = new Map(elements.map((e) => [e.elementNo, e]));
  const el = (n: number) => byNo.get(n)!;
  const supplier = await getSupplierForHeader();
  const part = ppap.partRevision.part;

  // ---- 1. General information (master data) ----
  const general = {
    customerName: ppap.customer.name,
    supplierName: supplier.name,
    partName: part.partName,
    partNumber: part.partNumber,
    drawingNumber: ppap.partRevision.drawingNo ?? part.partNumber,
    revision: ppap.partRevision.revision,
    level: ppap.level,
    submissionReason: ppap.reasonForSubmission,
  };

  // ---- 3. Material: lots from element 10, chemistry/mechanical from 12 ----
  const rmtc = await prisma.rmtcReportDetail.findUnique({
    where: { ppapElementId: el(10).id },
    include: { rows: { orderBy: { sortOrder: "asc" }, include: { materialSpec: true } } },
  });
  const lots = (rmtc?.rows ?? []).map((r) => ({
    grade: r.materialSpec?.grade ?? r.materialSpecText ?? null,
    standard: r.materialSpec?.standard ?? null,
    heatNo: r.heatNo,
    mtcNo: r.millTcNo,
  }));
  const fallbackSpec = part.materialSpec;
  const labReports = await prisma.labReport.findMany({
    where: { ppapElementId: el(12).id },
    orderBy: { sortOrder: "asc" },
    include: { chemicalResults: true, mechanicalResults: true },
  });
  const chemical = labReports.flatMap((rep) =>
    rep.chemicalResults.map((c) => ({ label: CHEM_LABEL[c.element] ?? c.element, status: computeNumericStatus(c.result, c.requirementMin, c.requirementMax) as ResultStatus })),
  );
  const mechanical = labReports.flatMap((rep) =>
    rep.mechanicalResults.map((m) => ({ label: MECH_LABEL[m.property] ?? m.property, status: computeNumericStatus(m.result, m.requirementMin, m.requirementMax) as ResultStatus })),
  );
  const material = {
    lots,
    fallbackGrade: fallbackSpec ? fallbackSpec.grade : null,
    fallbackStandard: fallbackSpec ? fallbackSpec.standard : null,
    chemicalSummary: summarizeLabStatuses(chemical),
    mechanicalSummary: summarizeLabStatuses(mechanical),
    labReportNos: labReports.map((r) => r.reportNo).filter((n): n is string => !!n),
  };

  // ---- 4. Dimensional results from element 9, drawing from element 1 ----
  const summary = await getConformanceSummary(el(9).id);
  const dimDetail = await prisma.dimensionalReportDetail.findUnique({
    where: { ppapElementId: el(9).id },
    include: { rows: { orderBy: { sortOrder: "asc" }, include: { readings: true, instrument: true } } },
  });
  const dimRows = (dimDetail?.rows ?? []).map((row) => {
    const parsed = parseDimensionAndTolerance(row.designDimensionText, row.toleranceText);
    const values = row.readings.map((r) => r.value).filter((v): v is number => v !== null);
    const status: ResultStatus = values.length === 0 || !parsed ? "UNKNOWN" : values.some((v) => computeStatus(v, parsed) === "NG") ? "NG" : "OK";
    return {
      id: row.id,
      slNo: row.slNo,
      dimension: row.parameterDescription ?? row.view ?? "",
      spec: [row.designDimensionText, row.toleranceText].filter(Boolean).join(" "),
      actual: values.join(" / "),
      status,
      instrument: row.instrument?.description ?? row.instrumentUsedText ?? null,
    };
  });
  const drawing = await prisma.drawingFile.findFirst({
    where: { ppapElementId: el(1).id, status: "ACTIVE" },
    orderBy: { uploadedAt: "desc" },
  });
  const dimensional = {
    summary: { total: summary.total, checked: summary.checked, ok: summary.ok, ng: summary.ng, pctConformance: summary.pctConformance },
    keyRows: pickKeyDimensionalRows(dimRows),
    drawing: drawing ? { url: drawing.fileUrl, name: drawing.fileName, revision: drawing.revision } : null,
  };

  // ---- 5. Appearance from element 13 ----
  const aar = el(13);
  const [aarDetail, aarRows, aarDisposition] = await Promise.all([
    prisma.aarDetail.findUnique({ where: { ppapElementId: aar.id } }),
    prisma.aarCriteriaRow.findMany({ where: { ppapElementId: aar.id }, orderBy: { sortOrder: "asc" } }),
    prisma.customerDisposition.findUnique({ where: { ppapElementId: aar.id } }),
  ]);
  const appearance = {
    applicable: aar.applicability !== "NA",
    naReason: aar.naReason,
    rows: aarRows.map((r) => ({ parameter: r.parameter, requirement: r.acceptanceCriteria ?? r.specification, result: r.result })),
    overallResult: aarDetail?.overallResult ? AAR_RESULT_LABEL[aarDetail.overallResult] : null,
    customerStatus: aarDisposition?.status ? DISPOSITION_LABEL[aarDisposition.status] : null,
  };

  // ---- 7. Process details from elements 5, 6, 7 ----
  const steps = await getProcessStepList(el(5).id);
  const stepNames = steps.map((s) => s.operationName);
  const [childPartCount, controlPlan] = await Promise.all([
    prisma.childPart.count({ where: { ppapElementId: el(5).id } }),
    prisma.controlPlanDetail.findUnique({ where: { ppapElementId: el(7).id }, include: { _count: { select: { rows: true } } } }),
  ]);
  const cpRows = controlPlan?._count.rows ?? 0;
  const process = {
    manufacturingProcess: stepNames.length ? stepNames.join(" → ") : null,
    specialProcesses: specialProcesses(stepNames),
    controlPlan: cpRows > 0 ? `Yes — ${cpRows} rows (${completionText(el(7).status, el(7).applicability)})` : "No",
    processFlow: childPartCount > 0 || steps.length > 0 ? `Attached — ${steps.length} operations (${completionText(el(5).status, el(5).applicability)})` : "Not attached",
    pfmea: completionText(el(6).status, el(6).applicability),
  };

  // ---- 8. MSA: instruments used (elements 7, 9, 8 — master from 16) ----
  const [cpInstrumentRows, msaStudies] = await Promise.all([
    controlPlan ? prisma.controlPlanRow.findMany({ where: { controlPlanDetailId: controlPlan.id, instrumentId: { not: null } }, select: { instrument: true } }) : [],
    prisma.msaStudy.findMany({ where: { ppapElementId: el(8).id }, orderBy: { sortOrder: "asc" }, include: { gauge: true } }),
  ]);
  const instruments = new Map<string, NonNullable<(typeof cpInstrumentRows)[number]["instrument"]>>();
  for (const r of cpInstrumentRows) if (r.instrument) instruments.set(r.instrument.id, r.instrument);
  for (const r of dimDetail?.rows ?? []) if (r.instrument) instruments.set(r.instrument.id, r.instrument);
  for (const s of msaStudies) if (s.gauge) instruments.set(s.gauge.id, s.gauge);

  const dueSoonDays = await getDueSoonDays();
  const msa = await Promise.all(
    [...instruments.values()].map(async (inst) => {
      const study = msaStudies.find((s) => s.gaugeId === inst.id);
      let grr: string;
      if (!study) grr = grrStatusText(null);
      else if (study.studyType !== "VARIABLE_GRR") grr = "Non-GR&R study recorded";
      else {
        const res = await getStudyResults(study.id);
        grr = res.complete && res.result ? grrStatusText({ pctGrr: res.result.pctGrrOfTv, verdict: res.result.verdict }) : grrStatusText("INCOMPLETE");
      }
      const cal = calibrationStatus(inst.calibrationDue, new Date(), dueSoonDays);
      return {
        id: inst.id,
        instrument: inst.ieIdNo ? `${inst.description} (${inst.ieIdNo})` : inst.description,
        type: study?.gaugeType ?? inst.make ?? null,
        calibration: inst.calibrationDue ? `${CALIBRATION_LABEL[cal]} — due ${formatDateIndia(inst.calibrationDue)}` : "No calibration record",
        calibrationStatus: cal,
        grr,
      };
    }),
  );
  msa.sort((a, b) => a.instrument.localeCompare(b.instrument));

  return { general, material, dimensional, appearance, process, msa };
}

/** Sample IDs from element 14's register, for AAR (element 13) section 3. */
export async function getSppSampleIdsForPpap(ppapId: string): Promise<string | null> {
  const element = await prisma.ppapElement.findUnique({ where: { ppapId_elementNo: { ppapId, elementNo: 14 } } });
  if (!element) return null;
  const samples = await prisma.sppSample.findMany({ where: { ppapElementId: element.id }, orderBy: { sortOrder: "asc" } });
  return samples.length ? samples.map((s) => s.sampleId).join(", ") : null;
}
