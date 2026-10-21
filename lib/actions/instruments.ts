"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertSupplierUser } from "@/lib/permissions";
import { saveUploadedFile } from "@/lib/storage";
import { computeCalibrationDue } from "@/lib/calc/calibration";
import { setDueSoonDays, sendCalibrationDigest } from "@/lib/instruments";

async function requireUserId() {
  return (await assertSupplierUser()).id;
}

async function audit(params: { userId: string; action: "CREATE" | "UPDATE" | "DELETE"; entityType: string; entityId: string; before: unknown; after: unknown; ppapId?: string }) {
  await prisma.auditLog.create({
    data: {
      ppapId: params.ppapId ?? null,
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      before: params.before as never,
      after: params.after as never,
    },
  });
}

function revalidateInstruments() {
  revalidatePath("/instruments");
  revalidatePath("/");
  // Every element page with an instrument picker or element 16's list.
  revalidatePath("/(app)/ppap/[id]/[element]", "page");
}

function str(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function utcDate(v: string | null): Date | null {
  return v ? new Date(`${v}T00:00:00.000Z`) : null;
}

const intOrNull = z.preprocess((v) => (v == null ? null : Number(v)), z.number().int().min(0).max(240).nullable());

// ---------------------------------------------------------------------------
// Instrument master
// ---------------------------------------------------------------------------

const instrumentSchema = z.object({
  slNo: intOrNull,
  description: z.string().min(1, "Description is required"),
  range: z.string().nullable(),
  serialNo: z.string().nullable(),
  ieIdNo: z.string().nullable(),
  make: z.string().nullable(),
  leastCount: z.string().nullable(),
  calibrationFrequencyMonths: intOrNull,
  calibratedOn: z.string().nullable(),
  dueOverride: z.string().nullable(),
  location: z.string().nullable(),
  remarks: z.string().nullable(),
});

/**
 * Create or update an instrument. Due date = calibrated on + frequency,
 * unless an override date is entered (then that date, flagged overridden).
 */
export async function saveInstrument(instrumentId: string | null, formData: FormData) {
  const userId = await requireUserId();
  const parsed = instrumentSchema.parse(Object.fromEntries(Object.keys(instrumentSchema.shape).map((k) => [k, str(formData, k)])));
  const calibratedOn = utcDate(parsed.calibratedOn);
  const override = utcDate(parsed.dueOverride);
  const computed = computeCalibrationDue(calibratedOn, parsed.calibrationFrequencyMonths);
  const data = {
    slNo: parsed.slNo,
    description: parsed.description,
    range: parsed.range,
    serialNo: parsed.serialNo,
    ieIdNo: parsed.ieIdNo,
    make: parsed.make,
    leastCount: parsed.leastCount,
    calibrationFrequencyMonths: parsed.calibrationFrequencyMonths,
    calibratedOn,
    calibrationDue: override ?? computed,
    calibrationDueOverridden: override !== null && override.getTime() !== computed?.getTime(),
    location: parsed.location,
    remarks: parsed.remarks,
  };

  if (data.ieIdNo) {
    const clash = await prisma.instrument.findUnique({ where: { ieIdNo: data.ieIdNo } });
    if (clash && clash.id !== instrumentId) throw new Error(`IE ID No. "${data.ieIdNo}" is already used by "${clash.description}".`);
  }

  if (instrumentId) {
    const before = await prisma.instrument.findUniqueOrThrow({ where: { id: instrumentId } });
    const after = await prisma.instrument.update({ where: { id: instrumentId }, data });
    await audit({ userId, action: "UPDATE", entityType: "Instrument", entityId: instrumentId, before, after });
  } else {
    const slNo = data.slNo ?? ((await prisma.instrument.aggregate({ _max: { slNo: true } }))._max.slNo ?? 0) + 1;
    const after = await prisma.instrument.create({ data: { ...data, slNo } });
    await audit({ userId, action: "CREATE", entityType: "Instrument", entityId: after.id, before: null, after });
  }
  revalidateInstruments();
}

/** Only an instrument nothing references can be deleted. */
export async function deleteInstrument(instrumentId: string) {
  const userId = await requireUserId();
  const inst = await prisma.instrument.findUniqueOrThrow({
    where: { id: instrumentId },
    include: { _count: { select: { controlPlanRows: true, msaStudies: true, dimensionalReportRows: true, spcStudies: true, ppapCheckingAids: true } } },
  });
  const uses = Object.values(inst._count).reduce((a, b) => a + b, 0);
  if (uses > 0) throw new Error(`"${inst.description}" is used on ${uses} PPAP row(s)/stud(ies) and cannot be deleted.`);
  await prisma.calibrationRecord.deleteMany({ where: { instrumentId } });
  await prisma.instrument.delete({ where: { id: instrumentId } });
  await audit({ userId, action: "DELETE", entityType: "Instrument", entityId: instrumentId, before: inst, after: null });
  revalidateInstruments();
}

// ---------------------------------------------------------------------------
// Calibration history
// ---------------------------------------------------------------------------

/**
 * Records a calibration (agency, certificate). If it's at least as recent
 * as the instrument's current calibration, the instrument's calibrated-on
 * and due date move to it (due = certificate's due date if given, else
 * calibrated on + frequency).
 */
export async function addCalibrationRecord(instrumentId: string, formData: FormData) {
  const userId = await requireUserId();
  const calibratedOn = utcDate(str(formData, "calibratedOn"));
  if (!calibratedOn) throw new Error("Calibration date is required.");
  const dueDate = utcDate(str(formData, "dueDate"));

  let certificate: { url: string; fileName: string; fileType: string } | null = null;
  const file = formData.get("certificate");
  if (file instanceof File && file.size > 0) {
    certificate = await saveUploadedFile(file, `instruments/${instrumentId}/calibration`);
  }

  const record = await prisma.calibrationRecord.create({
    data: {
      instrumentId,
      calibratedOn,
      dueDate,
      agency: str(formData, "agency"),
      certificateNo: str(formData, "certificateNo"),
      certificateFileUrl: certificate?.url ?? null,
      certificateFileName: certificate?.fileName ?? null,
      certificateFileType: certificate?.fileType ?? null,
      remarks: str(formData, "remarks"),
      recordedById: userId,
    },
  });
  await audit({ userId, action: "CREATE", entityType: "CalibrationRecord", entityId: record.id, before: null, after: record });

  const inst = await prisma.instrument.findUniqueOrThrow({ where: { id: instrumentId } });
  if (!inst.calibratedOn || calibratedOn >= inst.calibratedOn) {
    const computed = computeCalibrationDue(calibratedOn, inst.calibrationFrequencyMonths);
    const after = await prisma.instrument.update({
      where: { id: instrumentId },
      data: {
        calibratedOn,
        calibrationDue: dueDate ?? computed,
        calibrationDueOverridden: dueDate !== null && dueDate.getTime() !== computed?.getTime(),
      },
    });
    await audit({ userId, action: "UPDATE", entityType: "Instrument", entityId: instrumentId, before: inst, after });
  }
  revalidateInstruments();
}

export async function deleteCalibrationRecord(recordId: string) {
  const userId = await requireUserId();
  const before = await prisma.calibrationRecord.delete({ where: { id: recordId } });
  await audit({ userId, action: "DELETE", entityType: "CalibrationRecord", entityId: recordId, before, after: null });
  revalidateInstruments();
}

// ---------------------------------------------------------------------------
// Settings + digest
// ---------------------------------------------------------------------------

export async function saveDueSoonDays(formData: FormData) {
  const userId = await requireUserId();
  const days = z.coerce.number().int().min(0).max(365).parse(formData.get("dueSoonDays"));
  await setDueSoonDays(days);
  await audit({ userId, action: "UPDATE", entityType: "AppSetting", entityId: "calibration.dueSoonDays", before: null, after: { days } });
  revalidateInstruments();
}

export async function sendCalibrationDigestNow() {
  await requireUserId();
  try {
    return await sendCalibrationDigest();
  } catch (err) {
    throw new Error(`Could not send the digest: ${err instanceof Error ? err.message : String(err)}. Is the mail server (Maildev) running?`);
  }
}

// ---------------------------------------------------------------------------
// Fixture / gauge register
// ---------------------------------------------------------------------------

const fixtureSchema = z.object({
  code: z.string().min(1, "Code is required"),
  description: z.string().min(1, "Description is required"),
  type: z.enum(["CHECKING_FIXTURE", "TEMPLATE", "JIG", "GAUGE", "OTHER"]),
  partId: z.string().nullable(),
  drawingNo: z.string().nullable(),
  validationDate: z.string().nullable(),
  status: z.enum(["ACTIVE", "UNDER_VALIDATION", "REJECTED", "RETIRED"]),
  location: z.string().nullable(),
  remarks: z.string().nullable(),
});

export async function saveFixture(fixtureId: string | null, formData: FormData) {
  const userId = await requireUserId();
  const parsed = fixtureSchema.parse(Object.fromEntries(Object.keys(fixtureSchema.shape).map((k) => [k, str(formData, k)])));
  const clash = await prisma.fixture.findUnique({ where: { code: parsed.code } });
  if (clash && clash.id !== fixtureId) throw new Error(`Fixture code "${parsed.code}" is already used.`);

  const files: Record<string, string | null> = {};
  const drawing = formData.get("drawingFile");
  if (drawing instanceof File && drawing.size > 0) {
    const saved = await saveUploadedFile(drawing, "fixtures/drawings");
    files.drawingFileUrl = saved.url;
    files.drawingFileName = saved.fileName;
  }
  const validation = formData.get("validationRecord");
  if (validation instanceof File && validation.size > 0) {
    const saved = await saveUploadedFile(validation, "fixtures/validation");
    files.validationRecordUrl = saved.url;
    files.validationRecordName = saved.fileName;
  }

  const data = { ...parsed, validationDate: utcDate(parsed.validationDate), ...files };
  if (fixtureId) {
    const before = await prisma.fixture.findUniqueOrThrow({ where: { id: fixtureId } });
    const after = await prisma.fixture.update({ where: { id: fixtureId }, data });
    await audit({ userId, action: "UPDATE", entityType: "Fixture", entityId: fixtureId, before, after });
  } else {
    const after = await prisma.fixture.create({ data });
    await audit({ userId, action: "CREATE", entityType: "Fixture", entityId: after.id, before: null, after });
  }
  revalidateInstruments();
}

export async function deleteFixture(fixtureId: string) {
  const userId = await requireUserId();
  const before = await prisma.fixture.findUniqueOrThrow({ where: { id: fixtureId } });
  await prisma.ppapCheckingAid.deleteMany({ where: { fixtureId } });
  await prisma.fixture.delete({ where: { id: fixtureId } });
  await audit({ userId, action: "DELETE", entityType: "Fixture", entityId: fixtureId, before, after: null });
  revalidateInstruments();
}

// ---------------------------------------------------------------------------
// Element 16 manual additions
// ---------------------------------------------------------------------------

async function assertEditable(ppapElementId: string) {
  await assertSupplierUser();
  const element = await prisma.ppapElement.findUniqueOrThrow({ where: { id: ppapElementId } });
  if (element.status === "APPROVED") throw new Error("This page is approved and locked. Use Revise to edit it.");
  return element;
}

export async function addPpapCheckingAid(ppapElementId: string, ref: { instrumentId?: string; fixtureId?: string }) {
  const userId = await requireUserId();
  const element = await assertEditable(ppapElementId);
  if (!ref.instrumentId && !ref.fixtureId) throw new Error("Pick an instrument or fixture.");
  const where = ref.instrumentId
    ? { ppapElementId_instrumentId: { ppapElementId, instrumentId: ref.instrumentId } }
    : { ppapElementId_fixtureId: { ppapElementId, fixtureId: ref.fixtureId! } };
  const after = await prisma.ppapCheckingAid.upsert({ where, update: {}, create: { ppapElementId, ...ref } });
  await audit({ userId, ppapId: element.ppapId, action: "CREATE", entityType: "PpapCheckingAid", entityId: after.id, before: null, after });
  revalidatePath(`/ppap/${element.ppapId}/16`);
  revalidatePath(`/ppap/${element.ppapId}/16/print`);
}

export async function removePpapCheckingAid(ppapElementId: string, ref: { instrumentId?: string; fixtureId?: string }) {
  const userId = await requireUserId();
  const element = await assertEditable(ppapElementId);
  const rows = await prisma.ppapCheckingAid.findMany({ where: { ppapElementId, ...(ref.instrumentId ? { instrumentId: ref.instrumentId } : { fixtureId: ref.fixtureId }) } });
  for (const row of rows) {
    await prisma.ppapCheckingAid.delete({ where: { id: row.id } });
    await audit({ userId, ppapId: element.ppapId, action: "DELETE", entityType: "PpapCheckingAid", entityId: row.id, before: row, after: null });
  }
  revalidatePath(`/ppap/${element.ppapId}/16`);
  revalidatePath(`/ppap/${element.ppapId}/16/print`);
}
