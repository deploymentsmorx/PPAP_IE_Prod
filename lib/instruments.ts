import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { calibrationStatus, isInstrumentPickable, buildCalibrationDigest, DEFAULT_DUE_SOON_DAYS, type CalibrationStatus } from "@/lib/calc/calibration";

/**
 * Instrument master / Checking Aids (element 16) server helpers.
 */

const DUE_SOON_SETTING = "calibration.dueSoonDays";

/** The configurable DUE_SOON window (days), default 15 — see CLAUDE.md. */
export async function getDueSoonDays(): Promise<number> {
  const setting = await prisma.appSetting.findUnique({ where: { key: DUE_SOON_SETTING } });
  const n = setting ? Number(setting.value) : NaN;
  return Number.isInteger(n) && n >= 0 ? n : DEFAULT_DUE_SOON_DAYS;
}

export async function setDueSoonDays(days: number) {
  await prisma.appSetting.upsert({
    where: { key: DUE_SOON_SETTING },
    update: { value: String(days) },
    create: { key: DUE_SOON_SETTING, value: String(days) },
  });
}

/**
 * Picker guard shared by Control Plan, Dimensional, MSA and SPC: a newly
 * chosen instrument must be calibrated and not overdue. Re-saving a row
 * that already uses an instrument which has since gone overdue is allowed
 * (so other fields stay editable) — only picking it is blocked.
 */
export async function assertInstrumentPickable(instrumentId: string | null | undefined, previousInstrumentId?: string | null) {
  if (!instrumentId || instrumentId === previousInstrumentId) return;
  const instrument = await prisma.instrument.findUniqueOrThrow({ where: { id: instrumentId } });
  if (!isInstrumentPickable(instrument.calibrationDue)) {
    const why = instrument.calibrationDue ? "overdue for calibration" : "not calibrated";
    throw new Error(`"${instrument.description}${instrument.ieIdNo ? ` (${instrument.ieIdNo})` : ""}" is ${why} and cannot be selected.`);
  }
}

export type CheckingAidSource = "Control Plan" | "Dimensional Results" | "MSA" | "SPC" | "Added manually";

/**
 * Element 16 per PPAP: the instruments this part uses, auto-collected from
 * Control Plan (7), MSA (8), Dimensional Results (9) and SPC (11), plus
 * manual additions — and fixtures linked to the part plus manual ones.
 * Each entry lists where it's used.
 */
export async function getCheckingAidsForPpap(ppapId: string) {
  const ppap = await prisma.ppap.findUniqueOrThrow({ where: { id: ppapId }, include: { partRevision: true } });
  const elements = await prisma.ppapElement.findMany({ where: { ppapId, elementNo: { in: [7, 8, 9, 11, 16] } } });
  const idOf = (n: number) => elements.find((e) => e.elementNo === n)!.id;

  const [cpRows, msa, dimRows, spc, manual] = await Promise.all([
    prisma.controlPlanRow.findMany({ where: { controlPlanDetail: { ppapElementId: idOf(7) }, instrumentId: { not: null } }, select: { instrumentId: true } }),
    prisma.msaStudy.findMany({ where: { ppapElementId: idOf(8), gaugeId: { not: null } }, select: { gaugeId: true } }),
    prisma.dimensionalReportRow.findMany({ where: { dimensionalReportDetail: { ppapElementId: idOf(9) }, instrumentId: { not: null } }, select: { instrumentId: true } }),
    prisma.spcStudy.findMany({ where: { ppapElementId: idOf(11), instrumentId: { not: null } }, select: { instrumentId: true } }),
    prisma.ppapCheckingAid.findMany({ where: { ppapElementId: idOf(16) } }),
  ]);

  const sources = new Map<string, Set<CheckingAidSource>>();
  const add = (id: string | null, source: CheckingAidSource) => {
    if (!id) return;
    if (!sources.has(id)) sources.set(id, new Set());
    sources.get(id)!.add(source);
  };
  cpRows.forEach((r) => add(r.instrumentId, "Control Plan"));
  dimRows.forEach((r) => add(r.instrumentId, "Dimensional Results"));
  msa.forEach((r) => add(r.gaugeId, "MSA"));
  spc.forEach((r) => add(r.instrumentId, "SPC"));
  manual.forEach((m) => add(m.instrumentId, "Added manually"));

  const instruments = await prisma.instrument.findMany({ where: { id: { in: [...sources.keys()] } }, orderBy: [{ slNo: "asc" }, { description: "asc" }] });
  const manualFixtureIds = manual.map((m) => m.fixtureId).filter((id): id is string => !!id);
  const fixtures = await prisma.fixture.findMany({
    where: { OR: [{ partId: ppap.partRevision.partId }, { id: { in: manualFixtureIds } }] },
    orderBy: { code: "asc" },
  });

  return {
    instruments: instruments.map((i) => ({ ...i, usedIn: [...sources.get(i.id)!], manualOnly: sources.get(i.id)!.size === 1 && sources.get(i.id)!.has("Added manually") })),
    fixtures: fixtures.map((f) => ({ ...f, linkedToPart: f.partId === ppap.partRevision.partId, addedManually: manualFixtureIds.includes(f.id) })),
    manualEntries: manual,
  };
}

/** Counts by status for the dashboard widget. */
export async function getCalibrationSummary(today: Date = new Date()) {
  const [dueSoonDays, instruments] = await Promise.all([getDueSoonDays(), prisma.instrument.findMany({ orderBy: { calibrationDue: "asc" } })]);
  const withStatus = instruments.map((i) => ({ ...i, status: calibrationStatus(i.calibrationDue, today, dueSoonDays) }));
  const counts: Record<CalibrationStatus, number> = { VALID: 0, DUE_SOON: 0, OVERDUE: 0, NOT_CALIBRATED: 0 };
  for (const i of withStatus) counts[i.status]++;
  return { dueSoonDays, counts, attention: withStatus.filter((i) => i.status !== "VALID") };
}

/**
 * Weekly digest of due/overdue instruments to QA (QA_MANAGER, QA_ENGINEER,
 * ADMIN users with an email). Called by the scheduled route
 * (app/api/cron/calibration-digest) and the "Send digest now" button.
 */
export async function sendCalibrationDigest(today: Date = new Date()): Promise<{ sent: number; recipients: string[]; subject: string | null }> {
  const [dueSoonDays, instruments, users] = await Promise.all([
    getDueSoonDays(),
    prisma.instrument.findMany(),
    prisma.user.findMany({ where: { roles: { hasSome: ["QA_MANAGER", "QA_ENGINEER", "ADMIN"] } }, select: { email: true } }),
  ]);
  const digest = buildCalibrationDigest(instruments, today, dueSoonDays);
  if (!digest) return { sent: 0, recipients: [], subject: null };
  const recipients = users.map((u) => u.email).filter((e): e is string => !!e);
  for (const to of recipients) await sendMail(to, digest.subject, digest.text);
  return { sent: recipients.length, recipients, subject: digest.subject };
}
