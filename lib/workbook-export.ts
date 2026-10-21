import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { formatDateIndia } from "@/lib/format";
import { createSheetWriter } from "@/lib/excel-sheet";
import { PPAP_ELEMENT_NAMES } from "@/lib/constants/ppap-elements";
import { parseDimensionAndTolerance, computeStatus } from "@/lib/calc/tolerance";
import { computeControlChartStats, computeCapability, overallSigma, subgroupMean } from "@/lib/calc/spc";
import { PSW_REASONS, PSW_LEVELS } from "@/lib/calc/psw";
import { getPswView } from "@/lib/psw";
import { exportPfcWorkbook } from "@/lib/pfc-import";
import { exportPfmeaWorkbook } from "@/lib/pfmea-import";
import { exportLabWorkbook } from "@/lib/lab-export";
import { exportAarWorkbook } from "@/lib/aar-export";
import { exportSppWorkbook } from "@/lib/spp-export";
import { exportMasterSampleWorkbook } from "@/lib/master-sample-export";
import { exportCheckingAidsWorkbook } from "@/lib/checking-aids-export";
import { exportCsrWorkbook } from "@/lib/csr-export";

/** The reference workbook's 20 sheet names, in order (element 11 spans two sheets). */
export const REFERENCE_SHEETS: { name: string; elementNo: number }[] = [
  { name: "PPAP Checklist", elementNo: 0 },
  { name: "1. Design Record", elementNo: 1 },
  { name: "2. ECN Record", elementNo: 2 },
  { name: "3. CEA", elementNo: 3 },
  { name: "4. DFMEA", elementNo: 4 },
  { name: "5. PFC", elementNo: 5 },
  { name: "6. PFMEA", elementNo: 6 },
  { name: "7. Control Plan", elementNo: 7 },
  { name: "8. MSA", elementNo: 8 },
  { name: "9. Dimensional Report", elementNo: 9 },
  { name: "10. RMTC Reports", elementNo: 10 },
  { name: "11. SPC Results-1", elementNo: 11 },
  { name: "11. SPC Results-2", elementNo: 11 },
  { name: "12. LAB Reports", elementNo: 12 },
  { name: "13. AAR", elementNo: 13 },
  { name: "14. Sample Production Part", elementNo: 14 },
  { name: "15. Master Sample", elementNo: 15 },
  { name: "16. Checking Aids", elementNo: 16 },
  { name: "17. CSR", elementNo: 17 },
  { name: "18. PSW", elementNo: 18 },
];

const d = (v: Date | null | undefined) => (v ? formatDateIndia(v) : null);

/** Copies one worksheet (values, styles, column widths, row heights, merges) into another workbook. Pictures aren't copied. */
function copyWorksheet(src: ExcelJS.Worksheet, dst: ExcelJS.Workbook, name: string) {
  const ws = dst.addWorksheet(name, { pageSetup: { ...src.pageSetup } });
  src.columns?.forEach((c, i) => {
    if (c?.width) ws.getColumn(i + 1).width = c.width;
  });
  src.eachRow({ includeEmpty: true }, (row, r) => {
    const out = ws.getRow(r);
    if (row.height) out.height = row.height;
    row.eachCell({ includeEmpty: true }, (cell, c) => {
      const target = out.getCell(c);
      target.value = cell.value;
      target.style = JSON.parse(JSON.stringify(cell.style ?? {}));
    });
  });
  for (const range of (src.model as { merges?: string[] }).merges ?? []) ws.mergeCells(range);
  return ws;
}

/**
 * Full PPAP workbook in the client's 20-sheet structure. Sheets with a
 * per-element exporter reuse it (copied in); the rest are written here
 * with the reference sheet's column headings. Values, not formulas.
 */
export async function exportFullWorkbook(ppapId: string): Promise<ExcelJS.Workbook> {
  const ppap = await prisma.ppap.findUniqueOrThrow({
    where: { id: ppapId },
    include: { customer: true, partRevision: { include: { part: true } }, elements: { orderBy: { elementNo: "asc" } } },
  });
  const el = (n: number) => ppap.elements.find((e) => e.elementNo === n)!;
  const part = ppap.partRevision.part;
  const wb = new ExcelJS.Workbook();
  wb.creator = "PPAP Management — Ingenious Engineering";

  const reuse: Record<string, (elementId: string) => Promise<ExcelJS.Workbook>> = {
    "5. PFC": exportPfcWorkbook,
    "6. PFMEA": exportPfmeaWorkbook,
    "12. LAB Reports": exportLabWorkbook,
    "13. AAR": exportAarWorkbook,
    "14. Sample Production Part": exportSppWorkbook,
    "15. Master Sample": exportMasterSampleWorkbook,
    "16. Checking Aids": exportCheckingAidsWorkbook,
    "17. CSR": exportCsrWorkbook,
  };

  // The reused exporters are independent DB reads — fetch them in parallel, copy in sheet order.
  const reused = new Map(
    await Promise.all(
      REFERENCE_SHEETS.filter((s) => reuse[s.name]).map(async (s) => [s.name, await reuse[s.name](el(s.elementNo).id)] as const),
    ),
  );

  for (const sheet of REFERENCE_SHEETS) {
    const element = el(sheet.elementNo);
    const src = reused.get(sheet.name);
    if (src) {
      copyWorksheet(src.worksheets[0], wb, sheet.name);
      continue;
    }
    const ws = wb.addWorksheet(sheet.name, { pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    const w = createSheetWriter(ws, 12);
    w.heading("Ingenious Engineering", 14);
    w.heading(`PPAP DOCUMENTS — ${sheet.name.replace(/^\d+\.\s*/, "").toUpperCase()}`, 12);
    w.docLine(element.docNo, element.revision);
    w.heading(`${ppap.customer.name} — ${part.partName} (${part.partNumber} Rev.${ppap.partRevision.revision})`);
    w.gap();
    if (element.applicability === "NA") {
      w.heading(`N/A — ${element.naReason ?? ""}`);
      continue;
    }
    ws.columns = Array.from({ length: 12 }, () => ({ width: 16 }));
    await writers[sheet.name]?.(w, element.id, ppapId);
  }
  return wb;
}

type Writer = ReturnType<typeof createSheetWriter>;
const head = (cols: string[]) => [...cols, ...Array(Math.max(0, 12 - cols.length)).fill("")];

const writers: Record<string, (w: Writer, elementId: string, ppapId: string) => Promise<void>> = {
  "PPAP Checklist": async (w, _id, ppapId) => {
    const [rows, elements] = await Promise.all([prisma.checklistRow.findMany({ where: { ppapId } }), prisma.ppapElement.findMany({ where: { ppapId } })]);
    w.tableRow(head(["Sl.", "PPAP Element", "Required", "Status", "Remarks", "Document Reference", "Page status"]), { head: true });
    for (let n = 1; n <= 18; n++) {
      const r = rows.find((x) => x.elementNo === n);
      const e = elements.find((x) => x.elementNo === n);
      w.tableRow(head([String(n), PPAP_ELEMENT_NAMES[n], r?.requiredOverride ?? "", r?.statusOverride ?? "", r?.remarks ?? "", r?.docRefLabel || e?.docNo || "", e?.status ?? ""]));
    }
  },
  "1. Design Record": async (w, id, ppapId) => {
    const [dr, ppap, sc] = await Promise.all([
      prisma.designRecordDetail.findUnique({ where: { ppapElementId: id }, include: { materialSpec: true } }),
      prisma.ppap.findUniqueOrThrow({ where: { id: ppapId }, include: { customer: true, partRevision: { include: { part: true } } } }),
      prisma.specialCharacteristic.findMany({ where: { ppapElementId: id }, orderBy: { sortOrder: "asc" } }),
    ]);
    w.tableRow(head(["Sl. No.", "Particular", "Details", "Remarks"]), { head: true });
    const rows: [string, string | null | undefined, string | null | undefined][] = [
      ["Part Name", ppap.partRevision.part.partName, dr?.partNameRemarks],
      ["Part Number", ppap.partRevision.part.partNumber, dr?.partNumberRemarks],
      ["Customer Name", ppap.customer.name, dr?.customerNameRemarks],
      ["Drawing Number", ppap.partRevision.drawingNo, dr?.drawingNumberRemarks],
      ["Drawing Revision", ppap.partRevision.revision, dr?.drawingRevisionRemarks],
      ["Material Specification", dr?.materialSpec ? `${dr.materialSpec.standard} ${dr.materialSpec.grade}` : null, dr?.materialSpecRemarks],
      ["Heat Treatment", dr?.heatTreatment, dr?.heatTreatmentRemarks],
      ["Surface Finish", dr?.surfaceFinish, dr?.surfaceFinishRemarks],
      ["Special Characteristics", sc.map((s) => s.characteristic).join(", ") || "-", dr?.specialCharacteristicsRemarks],
    ];
    rows.forEach(([p, v, r], i) => w.tableRow(head([String(i + 1), p, v ?? "-", r ?? ""])));
  },
  "2. ECN Record": async (w, id) => {
    const ecns = await prisma.ecnRecord.findMany({ where: { ppapElementId: id }, orderBy: { ecnDate: "asc" } });
    w.tableRow(head(["ECN No.", "Date", "Change type", "Reason", "Existing", "Proposed", "Affected elements", "Implementation", "Status"]), { head: true });
    for (const e of ecns) {
      w.tableRow(head([e.ecnNumber ?? "", d(e.ecnDate) ?? "", e.changeType ?? "", e.reason ?? "", e.existingCondition ?? "", e.proposedChange ?? "", e.affectedElementNos.join(", "), d(e.implementationDate) ?? "", e.status ?? ""]));
    }
    if (ecns.length === 0) w.heading("No engineering change.");
  },
  "3. CEA": async (w, id) => {
    const c = await prisma.ceaDetail.findUnique({ where: { ppapElementId: id }, include: { declaredBy: true } });
    w.tableRow(head(["Field", "Value"]), { head: true });
    const f = (label: string, v: string | null | undefined) => w.tableRow(head([label, v ?? "-"]));
    f("CEA No.", c?.ceaNo);
    f("Date", d(c?.ceaDate));
    f("Request type", c?.requestType);
    f("Existing", c?.existingCondition);
    f("Proposed", c?.proposedChange);
    f("Reason", c?.changeReason);
    for (const [k, lvl, note] of [
      ["Fit", c?.impactFitLevel, c?.impactFitNote],
      ["Form", c?.impactFormLevel, c?.impactFormNote],
      ["Function", c?.impactFunctionLevel, c?.impactFunctionNote],
      ["Quality risk", c?.impactQualityRiskLevel, c?.impactQualityRiskNote],
      ["Reliability/Life", c?.impactReliabilityLevel, c?.impactReliabilityNote],
      ["Regulatory/Safety", c?.impactRegulatoryLevel, c?.impactRegulatoryNote],
    ] as const) {
      f(`Impact — ${k}`, [lvl, note].filter(Boolean).join(" — ") || null);
    }
    f("Tests performed", c?.testsPerformed);
    f("Standard", c?.testStandard);
    f("Result summary", c?.resultSummary);
    f("Submission status", c?.submissionStatus);
    f("Sample qty / lot / date", [c?.sampleQty, c?.sampleLotNo, d(c?.sampleSubmissionDate)].filter(Boolean).join(" / ") || null);
    f("Declared by", c?.declaredBy ? `${c.declaredBy.name} ${d(c.declaredAt) ?? ""}` : null);
  },
  "4. DFMEA": async (w, id) => {
    const det = await prisma.dfmeaDetail.findUnique({ where: { ppapElementId: id }, include: { rows: { orderBy: { sortOrder: "asc" }, include: { responsible: true } } } });
    w.tableRow(head(["Item/Function", "Failure Mode", "Effects", "S", "Causes", "O", "Controls", "D", "RPN", "Recommended Actions", "Responsibility / Target", "Action Taken"]), { head: true });
    for (const r of det?.rows ?? []) {
      w.tableRow([
        r.item,
        r.potentialFailureMode,
        r.effects,
        r.severity,
        r.causes,
        r.occurrence,
        [r.currentControlsPrevention, r.currentControlsDetection].filter(Boolean).join(" / "),
        r.detection,
        r.severity && r.occurrence && r.detection ? r.severity * r.occurrence * r.detection : null,
        r.recommendedActions,
        [r.responsible?.name, d(r.targetDate)].filter(Boolean).join(" / "),
        r.actionTaken,
      ]);
    }
  },
  "7. Control Plan": async (w, id) => {
    const cp = await prisma.controlPlanDetail.findUnique({
      where: { ppapElementId: id },
      include: { rows: { orderBy: { sortOrder: "asc" }, include: { instrument: true, specialCharacteristic: true } } },
    });
    w.tableRow(head(["Process / Operation", "Machine / Jig", "Product char.", "Process char.", "Special char.", "Spec / Tolerance", "Evaluation technique", "Instrument", "Sample size / freq.", "Control method", "Reaction plan"]), { head: true });
    for (const r of cp?.rows ?? []) {
      w.tableRow(
        head([
          r.processNameOperation ?? "",
          r.machineDeviceJigTools ?? "",
          r.productCharacteristic ?? "",
          r.processCharacteristic ?? "",
          r.specialCharacteristic?.characteristic ?? "",
          r.productProcessSpecification ?? "",
          r.evaluationMeasurementTechnique ?? "",
          r.instrument ? `${r.instrument.description}${r.instrument.ieIdNo ? ` (${r.instrument.ieIdNo})` : ""}` : "",
          [r.sampleSize, r.sampleFrequency].filter(Boolean).join(" / "),
          r.controlMethod ?? "",
          r.reactionPlan ?? "",
        ]),
      );
    }
  },
  "8. MSA": async (w, id) => {
    const studies = await prisma.msaStudy.findMany({ where: { ppapElementId: id }, orderBy: { sortOrder: "asc" }, include: { gauge: true, dataPoints: true } });
    w.tableRow(head(["Study", "Type", "Date", "Gauge", "Characteristic", "Spec", "Parts × Appraisers × Trials", "Readings entered"]), { head: true });
    studies.forEach((s, i) =>
      w.tableRow(head([String(i + 1), s.studyType, d(s.studyDate) ?? "", s.gauge?.description ?? "", s.characteristicText ?? "", s.specification ?? "", `${s.parts} × ${s.appraisers} × ${s.trials}`, String(s.dataPoints.filter((p) => p.value !== null).length)])),
    );
    w.heading("GR&R results are computed in the app (8. MSA) and printed in the PDF pack.");
  },
  "9. Dimensional Report": async (w, id) => {
    const det = await prisma.dimensionalReportDetail.findUnique({
      where: { ppapElementId: id },
      include: { sampleColumns: { orderBy: { sortOrder: "asc" } }, rows: { orderBy: { sortOrder: "asc" }, include: { readings: true, instrument: true } } },
    });
    const cols = det?.sampleColumns ?? [];
    w.tableRow(head(["Sl. No.", "View", "Parameter", "Design dim.", "Tolerance", ...cols.map((c) => c.label), "Instrument", "Status", "Remarks"]), { head: true });
    for (const r of det?.rows ?? []) {
      const parsed = parseDimensionAndTolerance(r.designDimensionText, r.toleranceText);
      const values = cols.map((c) => r.readings.find((x) => x.sampleColumnId === c.id)?.value ?? null);
      const entered = values.filter((v): v is number => v !== null);
      const status = !parsed || entered.length === 0 ? "" : entered.some((v) => computeStatus(v, parsed) === "NG") ? "NG" : "OK";
      w.tableRow(head([r.slNo, r.view ?? "", r.parameterDescription ?? "", r.designDimensionText ?? "", r.toleranceText ?? "", ...values.map((v) => (v === null ? "" : String(v))), r.instrument?.description ?? r.instrumentUsedText ?? "", status, r.remarks ?? ""]), {
        ng: status === "NG",
      });
    }
  },
  "10. RMTC Reports": async (w, id) => {
    const det = await prisma.rmtcReportDetail.findUnique({ where: { ppapElementId: id }, include: { rows: { orderBy: { sortOrder: "asc" }, include: { materialSpec: true } } } });
    w.tableRow(head(["Sl. No.", "Part No.", "Standard / Grade", "Required size", "Qty", "Observed size", "Mill TC No.", "TC Date", "Heat No.", "Plate No.", "Material ID", "Lab report"]), { head: true });
    for (const r of det?.rows ?? []) {
      w.tableRow([
        r.slNo,
        r.partNo,
        r.materialSpec ? `${r.materialSpec.standard} ${r.materialSpec.grade}` : r.materialSpecText,
        r.requiredSizeText,
        r.qtyNos,
        r.observedSizeText,
        r.millTcNo,
        d(r.millTcDate),
        r.heatNo,
        r.plateNo,
        r.materialIdNo,
        r.labReportNo,
      ]);
    }
  },
  "11. SPC Results-1": async (w, id) => {
    const studies = await prisma.spcStudy.findMany({ where: { ppapElementId: id }, orderBy: { sortOrder: "asc" }, include: { readings: true, specialCharacteristic: true, instrument: true } });
    if (studies.length === 0) w.heading("No SPC study recorded.");
    for (const [i, s] of studies.entries()) {
      w.heading(`Study ${i + 1} — ${s.specialCharacteristic?.characteristic ?? "characteristic"} · USL ${s.usl ?? "-"} / LSL ${s.lsl ?? "-"} · ${s.instrument?.description ?? ""}`);
      const subgroups = Array.from({ length: s.subgroupCount }, (_, g) =>
        Array.from({ length: s.subgroupSize }, (_, k) => s.readings.find((r) => r.subgroupIndex === g && r.withinIndex === k)?.value ?? null),
      );
      w.tableRow(head(["Subgroup", ...Array.from({ length: s.subgroupSize }, (_, k) => `X${k + 1}`), "X̄", "R"]), { head: true });
      subgroups.forEach((sg, g) => {
        const vals = sg.filter((v): v is number => v !== null);
        w.tableRow(head([String(g + 1), ...sg.map((v) => (v === null ? "" : String(v))), vals.length ? subgroupMean(vals).toFixed(s.decimals) : "", vals.length ? (Math.max(...vals) - Math.min(...vals)).toFixed(s.decimals) : ""]));
      });
      const complete = subgroups.every((sg) => sg.every((v) => v !== null));
      if (complete && s.usl !== null && s.lsl !== null) {
        const stats = computeControlChartStats(subgroups as number[][]);
        const all = (subgroups as number[][]).flat();
        const cap = computeCapability({ usl: s.usl, lsl: s.lsl, xBarBar: stats.xBarBar, overallMean: subgroupMean(all), sigmaWithin: stats.sigmaWithin, sigmaOverall: overallSigma(all) });
        w.tableRow(head(["Cp", cap.cp.toFixed(3), "Cpk", cap.cpk.toFixed(3), "Pp", cap.pp.toFixed(3), "Ppk", cap.ppk.toFixed(3)]));
      }
      w.gap();
    }
  },
  "11. SPC Results-2": async (w, id) => {
    const studies = await prisma.spcStudy.findMany({ where: { ppapElementId: id }, orderBy: { sortOrder: "asc" }, include: { readings: { orderBy: [{ subgroupIndex: "asc" }, { withinIndex: "asc" }] } } });
    w.heading("Individuals run chart data (one reading per row, in production order).");
    w.tableRow(head(["Study", "Reading #", "Value", "USL", "LSL"]), { head: true });
    for (const [i, s] of studies.entries()) {
      s.readings.forEach((r, n) => w.tableRow(head([String(i + 1), String(n + 1), r.value === null ? "" : String(r.value), String(s.usl ?? ""), String(s.lsl ?? "")])));
    }
  },
  "18. PSW": async (w, _id, ppapId) => {
    const v = await getPswView(ppapId);
    const p = v.detail;
    const f = (label: string, value: string | number | null | undefined) => w.tableRow(head([label, value === null || value === undefined || value === "" ? "-" : String(value)]));
    w.tableRow(head(["Field", "Value"]), { head: true });
    f("Part Name", v.partInfo.partName);
    f("Part Number", v.partInfo.customerPartNumber);
    f("Engineering Drawing Change Level / Dated", `${v.partInfo.ecl} / ${d(v.partInfo.eclDate) ?? "-"}`);
    f("Additional Engineering Changes", v.partInfo.additionalChanges.map((c) => `${c.ecnNumber} (${d(c.ecnDate)})`).join(", "));
    f("Shown on Drawing Number", v.partInfo.drawingNo);
    f("Safety and/or Government Regulation", p?.safetyGovRegulation === null || p?.safetyGovRegulation === undefined ? null : p.safetyGovRegulation ? "Yes" : "No");
    f("Purchase Order No.", p?.poNumber);
    f("Weight (kg)", v.partInfo.weightKg);
    f("Checking Aid No. / ECL / Dated", [v.defaults.checkingAidNo, p?.checkingAidEcl, d(p?.checkingAidEclDate)].filter(Boolean).join(" / "));
    f("Supplier", `${v.supplierInfo.name}${v.supplierInfo.code ? ` (${v.supplierInfo.code})` : ""}, ${v.supplierInfo.street ?? ""}, ${v.supplierInfo.city ?? ""} ${v.supplierInfo.zip ?? ""}`);
    f("Customer Name/Division", v.submissionInfo.customerDivision);
    f("Buyer/Buyer Code", v.submissionInfo.buyer);
    f("Application", v.submissionInfo.application);
    f("Reason for Submission", PSW_REASONS.filter((r) => v.defaults.reasons.includes(r.code)).map((r) => r.label).join(", "));
    f("Requested Submission Level", PSW_LEVELS[v.level]);
    f("Results — dimensional / material & functional / appearance / statistical", Object.values(v.results).join(" / "));
    f("Results meet all requirements", p?.resultsMeetRequirements === null || p?.resultsMeetRequirements === undefined ? null : p.resultsMeetRequirements ? "YES" : "NO");
    f("Explanation/Comments", p?.explanation);
    f("Print Name / Title / Phone", [p?.printName, p?.title, p?.phone].filter(Boolean).join(" / "));
    f("Supplier Authorized Signature / Date", p?.signedAt ? `e-signed by ${p.signedBy?.name} / ${d(p.signedAt)}` : null);
    f("Customer Part Disposition", v.disposition?.status ? ({ APPROVED: "Approved", REJECTED: "Rejected", CONDITIONAL: "Other" } as const)[v.disposition.status] : null);
    f("Customer Name / Date", [v.disposition?.customerName, d(v.disposition?.customerSignatureDate)].filter(Boolean).join(" / "));
  },
};
