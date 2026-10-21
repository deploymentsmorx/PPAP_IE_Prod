import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getProcessStepList } from "@/lib/actions/pfc";
import { calculateActionPriority, parseApText } from "@/lib/calc/ap";

/**
 * Shared import/sync logic for element 6 (PFMEA). Two independent
 * ingestion paths feed the same PfmeaProcessStep/PfmeaRow tables:
 *  - syncProcessStepsFromPfc: pulls the ordered step list element 5
 *    already derives (lib/calc/process-flow.ts), for the "Sync from PFC"
 *    button. Steps are additive — a step no longer present upstream is
 *    flagged, never deleted, since PfmeaRow failure modes reference it.
 *  - importPfmeaWorkbook: parses an uploaded "6. PFMEA"-shaped sheet. The
 *    source workbook's process-step names are a broader "general process"
 *    view (e.g. "De-slagging", "Bevelling") that don't all map onto the
 *    narrower PFC Operation library, so imported steps are free text with
 *    no operationCode — only steps synced from PFC get one.
 */

export async function syncProcessStepsFromPfc(
  pfmeaElementId: string,
): Promise<{ added: number; flaggedRemoved: number }> {
  const pfmeaElement = await prisma.ppapElement.findUniqueOrThrow({ where: { id: pfmeaElementId } });
  const pfcElement = await prisma.ppapElement.findUnique({
    where: { ppapId_elementNo: { ppapId: pfmeaElement.ppapId, elementNo: 5 } },
  });
  if (!pfcElement) {
    throw new Error("This PPAP has no Process Flow Chart (element 5) to sync from.");
  }

  const derived = await getProcessStepList(pfcElement.id);
  const derivedCodes = new Set(derived.map((s) => s.operationCode));

  const existing = await prisma.pfmeaProcessStep.findMany({ where: { ppapElementId: pfmeaElementId } });
  const existingByCode = new Map(existing.filter((s) => s.operationCode).map((s) => [s.operationCode!, s]));

  let added = 0;
  let flaggedRemoved = 0;

  for (let i = 0; i < derived.length; i++) {
    const step = derived[i];
    const match = existingByCode.get(step.operationCode);
    if (match) {
      if (match.removedFromSource || match.sortOrder !== i) {
        await prisma.pfmeaProcessStep.update({
          where: { id: match.id },
          data: { removedFromSource: false, sortOrder: i, name: step.operationName },
        });
      }
    } else {
      await prisma.pfmeaProcessStep.create({
        data: {
          ppapElementId: pfmeaElementId,
          operationCode: step.operationCode,
          name: step.operationName,
          sortOrder: i,
        },
      });
      added++;
    }
  }

  for (const s of existing) {
    if (s.operationCode && !derivedCodes.has(s.operationCode) && !s.removedFromSource) {
      await prisma.pfmeaProcessStep.update({ where: { id: s.id }, data: { removedFromSource: true } });
      flaggedRemoved++;
    }
  }

  return { added, flaggedRemoved };
}

function cellText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") {
    const rt = v as { richText?: { text: string }[]; text?: string; result?: unknown };
    if (rt.richText) return rt.richText.map((r) => r.text).join("");
    if (rt.text) return String(rt.text);
    return "";
  }
  return String(v).trim();
}

function cellDate(v: unknown): Date | null {
  if (v instanceof Date) return v;
  return null;
}

function cellInt(v: unknown): number | null {
  const t = cellText(v);
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n) : null;
}

type ParsedPfmeaRow = {
  stepName: string;
  processFunction: string | null;
  potentialFailureMode: string | null;
  potentialEffect: string | null;
  severity: number | null;
  potentialCause: string | null;
  occurrence: number | null;
  currentPreventionControls: string | null;
  currentDetectionControls: string | null;
  detection: number | null;
  importedApText: string | null;
  recommendedActions: string | null;
  responsibleText: string | null;
  targetDate: Date | null;
  actionTaken: string | null;
  revisedSeverity: number | null;
  revisedOccurrence: number | null;
  revisedDetection: number | null;
  importedRevisedApText: string | null;
  revisionNo: string | null;
  revisionDate: Date | null;
};

function parsePfmeaSheet(sheet: ExcelJS.Worksheet): ParsedPfmeaRow[] {
  const rows: ParsedPfmeaRow[] = [];
  for (let r = 8; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const stepName = cellText(row.getCell(1).value);
    if (!stepName) continue;

    rows.push({
      stepName,
      processFunction: cellText(row.getCell(2).value) || null,
      potentialFailureMode: cellText(row.getCell(3).value) || null,
      potentialEffect: cellText(row.getCell(4).value) || null,
      severity: cellInt(row.getCell(5).value),
      potentialCause: cellText(row.getCell(6).value) || null,
      occurrence: cellInt(row.getCell(7).value),
      currentPreventionControls: cellText(row.getCell(8).value) || null,
      currentDetectionControls: cellText(row.getCell(9).value) || null,
      detection: cellInt(row.getCell(10).value),
      importedApText: cellText(row.getCell(12).value) || null,
      recommendedActions: cellText(row.getCell(13).value) || null,
      responsibleText: cellText(row.getCell(14).value) || null,
      targetDate: cellDate(row.getCell(15).value),
      actionTaken: cellText(row.getCell(16).value) || null,
      revisedSeverity: cellInt(row.getCell(17).value),
      revisedOccurrence: cellInt(row.getCell(18).value),
      revisedDetection: cellInt(row.getCell(19).value),
      importedRevisedApText: cellText(row.getCell(20).value) || null,
      revisionNo: cellText(row.getCell(21).value) || null,
      revisionDate: cellDate(row.getCell(22).value),
    });
  }
  return rows;
}

async function wipeExistingPfmeaData(ppapElementId: string) {
  const steps = await prisma.pfmeaProcessStep.findMany({ where: { ppapElementId }, select: { id: true } });
  const stepIds = steps.map((s) => s.id);
  await prisma.pfmeaRow.deleteMany({ where: { pfmeaProcessStepId: { in: stepIds } } });
  await prisma.pfmeaProcessStep.deleteMany({ where: { ppapElementId } });
}

export async function importPfmeaWorkbook(
  workbook: ExcelJS.Workbook,
  ppapElementId: string,
): Promise<{ imported: number; apMismatches: number }> {
  const sheet = workbook.worksheets.find((s) => /PFMEA/i.test(s.name));
  if (!sheet) throw new Error('No "PFMEA" sheet found in the uploaded workbook.');

  const rows = parsePfmeaSheet(sheet);
  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  const userIdByName = new Map(users.map((u) => [u.name.trim().toUpperCase(), u.id]));

  await wipeExistingPfmeaData(ppapElementId);

  let stepSortOrder = 0;
  let rowSortOrder = 0;
  let apMismatches = 0;
  const stepIdByName = new Map<string, string>();

  for (const row of rows) {
    let stepId = stepIdByName.get(row.stepName);
    if (!stepId) {
      const step = await prisma.pfmeaProcessStep.create({
        data: { ppapElementId, name: row.stepName, sortOrder: stepSortOrder++ },
      });
      stepId = step.id;
      stepIdByName.set(row.stepName, stepId);
      rowSortOrder = 0;
    }

    const responsibleId = row.responsibleText ? userIdByName.get(row.responsibleText.trim().toUpperCase()) : undefined;

    if (row.severity && row.occurrence && row.detection) {
      const computed = calculateActionPriority(row.severity, row.occurrence, row.detection);
      const typed = parseApText(row.importedApText);
      if (typed && typed !== computed) apMismatches++;
    }

    await prisma.pfmeaRow.create({
      data: {
        pfmeaProcessStepId: stepId,
        processFunction: row.processFunction,
        potentialFailureMode: row.potentialFailureMode,
        potentialEffect: row.potentialEffect,
        severity: row.severity,
        potentialCause: row.potentialCause,
        occurrence: row.occurrence,
        currentPreventionControls: row.currentPreventionControls,
        currentDetectionControls: row.currentDetectionControls,
        detection: row.detection,
        importedApText: row.importedApText,
        recommendedActions: row.recommendedActions,
        responsibleId: responsibleId ?? null,
        responsibleText: row.responsibleText,
        targetDate: row.targetDate,
        actionTaken: row.actionTaken,
        revisedSeverity: row.revisedSeverity,
        revisedOccurrence: row.revisedOccurrence,
        revisedDetection: row.revisedDetection,
        importedRevisedApText: row.importedRevisedApText,
        revisionNo: row.revisionNo,
        revisionDate: row.revisionDate,
        sortOrder: rowSortOrder++,
      },
    });
  }

  return { imported: rows.length, apMismatches };
}

const HEADER = [
  "Process Step",
  "Process Function",
  "Potential Failure Mode",
  "Potential Effect(s) of Failure",
  "Severity (S)",
  "Potential Cause(s)",
  "Occurrence (O)",
  "Current Prevention Controls",
  "Current Detection Controls",
  "Detection (D)",
  "RPN (Risk Priority Number)",
  "Action Priority (AP)",
  "Recommended Actions",
  "Responsible Person",
  "Target Date",
  "Action Taken",
  "Revised S",
  "Revised O",
  "Revised D",
  "Revised AP",
  "Revision No",
  "Revision Date",
];

/// Reproduces the "6. PFMEA" sheet's 22-column layout from the current
/// PfmeaProcessStep/PfmeaRow data, for download.
export async function exportPfmeaWorkbook(ppapElementId: string): Promise<ExcelJS.Workbook> {
  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { id: ppapElementId },
    include: { ppap: { include: { partRevision: { include: { part: true } } } } },
  });
  const steps = await prisma.pfmeaProcessStep.findMany({
    where: { ppapElementId },
    orderBy: { sortOrder: "asc" },
    include: { rows: { orderBy: { sortOrder: "asc" }, include: { responsible: true } } },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("6. PFMEA", { pageSetup: { orientation: "landscape" } });

  sheet.getCell(3, 1).value = `PFMEA - GENERAL PROCESS- Part Name: ${element.ppap.partRevision.part.partName}`;
  sheet.getCell(4, 1).value = `Doc. No.: ${element.docNo ?? ""}`;

  const headerRow = sheet.getRow(7);
  HEADER.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h;
  });

  let r = 8;
  for (const step of steps) {
    for (const row of step.rows) {
      const cells = sheet.getRow(r);
      cells.getCell(1).value = step.name;
      cells.getCell(2).value = row.processFunction;
      cells.getCell(3).value = row.potentialFailureMode;
      cells.getCell(4).value = row.potentialEffect;
      cells.getCell(5).value = row.severity;
      cells.getCell(6).value = row.potentialCause;
      cells.getCell(7).value = row.occurrence;
      cells.getCell(8).value = row.currentPreventionControls;
      cells.getCell(9).value = row.currentDetectionControls;
      cells.getCell(10).value = row.detection;
      if (row.severity && row.occurrence && row.detection) {
        cells.getCell(11).value = row.severity * row.occurrence * row.detection;
        cells.getCell(12).value = calculateActionPriority(row.severity, row.occurrence, row.detection);
      }
      cells.getCell(13).value = row.recommendedActions;
      cells.getCell(14).value = row.responsible?.name ?? row.responsibleText;
      cells.getCell(15).value = row.targetDate ? row.targetDate.toISOString().slice(0, 10) : null;
      cells.getCell(16).value = row.actionTaken;
      cells.getCell(17).value = row.revisedSeverity;
      cells.getCell(18).value = row.revisedOccurrence;
      cells.getCell(19).value = row.revisedDetection;
      if (row.revisedSeverity && row.revisedOccurrence && row.revisedDetection) {
        cells.getCell(20).value = calculateActionPriority(row.revisedSeverity, row.revisedOccurrence, row.revisedDetection);
      }
      cells.getCell(21).value = row.revisionNo;
      cells.getCell(22).value = row.revisionDate ? row.revisionDate.toISOString().slice(0, 10) : null;
      r++;
    }
  }

  return workbook;
}
