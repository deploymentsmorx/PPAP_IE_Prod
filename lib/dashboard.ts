import { prisma } from "@/lib/prisma";
import { pswReadiness } from "@/lib/calc/psw";
import { getCalibrationSummary } from "@/lib/instruments";
import { getMasterSampleExpiryReminders } from "@/lib/master-sample";
import type { permissionsFor } from "@/lib/calc/permissions";

/** Elements that carry a customer disposition (CEA, AAR, Sample Production Part, PSW). */
const DISPOSITION_ELEMENTS = [3, 13, 14, 18];
const DONE = new Set(["APPROVED", "SUBMITTED", "CUSTOMER_APPROVED"]);

type Viewer = { id: string; customerId: string | null; can: ReturnType<typeof permissionsFor> };

/**
 * Everything on the home dashboard, scoped to the viewer: a customer-only
 * login sees just its own customer's PPAPs and the decisions waiting on it.
 */
export async function getDashboard(viewer: Viewer, today: Date = new Date()) {
  const ppapWhere = viewer.can.ownCustomerOnly ? { customerId: viewer.customerId ?? "__none__" } : {};
  const ppaps = await prisma.ppap.findMany({
    where: ppapWhere,
    orderBy: { createdAt: "desc" },
    include: {
      customer: true,
      partRevision: { include: { part: true } },
      elements: { include: { customerDisposition: true }, orderBy: { elementNo: "asc" } },
    },
  });

  // ---- PPAPs by customer and status, % complete ----
  const byCustomer = new Map<string, { customer: string; OPEN: number; SUBMITTED: number; CLOSED: number }>();
  const list = ppaps.map((p) => {
    const row = byCustomer.get(p.customer.name) ?? { customer: p.customer.name, OPEN: 0, SUBMITTED: 0, CLOSED: 0 };
    row[p.status]++;
    byCustomer.set(p.customer.name, row);
    const required = p.elements.filter((e) => e.applicability === "REQUIRED" && e.elementNo !== 18);
    const done = required.filter((e) => DONE.has(e.status)).length;
    return {
      id: p.id,
      partName: p.partRevision.part.partName,
      partNumber: p.partRevision.part.partNumber,
      revision: p.partRevision.revision,
      customer: p.customer.name,
      level: p.level,
      status: p.status,
      approvalMode: p.approvalMode,
      pctComplete: required.length ? Math.round((done / required.length) * 100) : 0,
      readyToSign: pswReadiness(p.elements).ready,
    };
  });

  // ---- Pending my sign-off (open PPAPs) ----
  const awaitingStatus = viewer.can.approvePages ? "CHECKED" : "PREPARED";
  const pendingMine = viewer.can.editSupplierData
    ? ppaps
        .filter((p) => p.status === "OPEN")
        .flatMap((p) =>
          p.elements
            .filter((e) => e.status === awaitingStatus && e.applicability !== "NA")
            .map((e) => ({ ppapId: p.id, partNumber: p.partRevision.part.partNumber, revision: p.partRevision.revision, elementNo: e.elementNo, stage: viewer.can.approvePages ? "approval" : "check" })),
        )
    : [];

  // ---- Customer decisions awaiting / signed copies missing ----
  const decisions = ppaps.flatMap((p) =>
    p.elements
      .filter(
        (e) =>
          DISPOSITION_ELEMENTS.includes(e.elementNo) &&
          e.applicability !== "NA" &&
          !e.customerDisposition?.status &&
          // Supplier side done: the PSW signed (SUBMITTED), other pages approved.
          (e.elementNo === 18 ? p.status === "SUBMITTED" : e.status === "APPROVED"),
      )
      .map((e) => ({
        ppapId: p.id,
        partNumber: p.partRevision.part.partNumber,
        revision: p.partRevision.revision,
        customer: p.customer.name,
        elementNo: e.elementNo,
        kind: p.approvalMode === "CUSTOMER_PORTAL" ? ("AWAITING_CUSTOMER" as const) : ("SIGNED_COPY_MISSING" as const),
      })),
  );

  // ---- Supplier-only widgets ----
  if (!viewer.can.editSupplierData) {
    return { list, byCustomer: [...byCustomer.values()], pendingMine, decisions, fmeaActions: null, calibration: null, masterSamples: null };
  }
  const openPpapIds = ppaps.filter((p) => p.status !== "CLOSED").map((p) => p.id);
  // A recommended action with nothing recorded as taken yet.
  const openAction = () => ({ recommendedActions: { not: null }, OR: [{ actionTaken: null }, { actionTaken: "" }] });
  const [pfmea, dfmea] = await Promise.all([
    prisma.pfmeaRow.findMany({
      where: { ...openAction(), NOT: { recommendedActions: "" }, pfmeaProcessStep: { ppapElement: { ppapId: { in: openPpapIds } } } },
      select: { id: true, recommendedActions: true, targetDate: true, responsible: { select: { name: true } }, responsibleText: true, pfmeaProcessStep: { select: { name: true, ppapElement: { select: { ppapId: true } } } } },
    }),
    prisma.dfmeaRow.findMany({
      where: { ...openAction(), NOT: { recommendedActions: "" }, dfmeaDetail: { ppapElement: { ppapId: { in: openPpapIds } } } },
      select: { id: true, recommendedActions: true, targetDate: true, item: true, responsible: { select: { name: true } }, dfmeaDetail: { select: { ppapElement: { select: { ppapId: true } } } } },
    }),
  ]);
  const ppapLabel = new Map(ppaps.map((p) => [p.id, `${p.partRevision.part.partNumber} Rev.${p.partRevision.revision}`]));
  const startOfToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const fmeaActions = [
    ...pfmea.map((r) => ({
      id: r.id,
      fmea: "PFMEA" as const,
      elementNo: 6,
      ppapId: r.pfmeaProcessStep.ppapElement.ppapId,
      what: `${r.pfmeaProcessStep.name}: ${r.recommendedActions}`,
      responsible: r.responsible?.name ?? r.responsibleText ?? null,
      targetDate: r.targetDate,
    })),
    ...dfmea.map((r) => ({
      id: r.id,
      fmea: "DFMEA" as const,
      elementNo: 4,
      ppapId: r.dfmeaDetail.ppapElement.ppapId,
      what: `${r.item ?? "Item"}: ${r.recommendedActions}`,
      responsible: r.responsible?.name ?? null,
      targetDate: r.targetDate,
    })),
  ]
    .map((a) => ({ ...a, ppapLabel: ppapLabel.get(a.ppapId) ?? "", overdue: !!a.targetDate && a.targetDate.getTime() < startOfToday }))
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.targetDate?.getTime() ?? Infinity) - (b.targetDate?.getTime() ?? Infinity));

  const [calibration, masterSamples] = await Promise.all([getCalibrationSummary(today), getMasterSampleExpiryReminders(today)]);
  return { list, byCustomer: [...byCustomer.values()], pendingMine, decisions, fmeaActions, calibration, masterSamples };
}
