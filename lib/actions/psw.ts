"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertSupplierUser, assertCan } from "@/lib/permissions";
import { pswReadiness, pswSignErrors, PSW_REASONS } from "@/lib/calc/psw";
import { PPAP_ELEMENT_NAMES } from "@/lib/constants/ppap-elements";
import { runConsistencyChecks } from "@/lib/consistency";

async function requireUserId() {
  return (await assertSupplierUser()).id;
}

async function audit(params: { userId: string; ppapId: string; action: "CREATE" | "UPDATE" | "APPROVE"; entityType: string; entityId: string; before: unknown; after: unknown }) {
  await prisma.auditLog.create({ data: { ...params, before: params.before as never, after: params.after as never } });
}

function revalidatePsw(ppapId: string) {
  revalidatePath(`/ppap/${ppapId}`, "layout");
  revalidatePath("/");
}

async function loadEditable(ppapElementId: string) {
  const element = await prisma.ppapElement.findUniqueOrThrow({ where: { id: ppapElementId }, include: { ppap: true, pswDetail: true } });
  if (element.elementNo !== 18) throw new Error("Not a PSW (element 18).");
  if (element.ppap.status === "CLOSED") throw new Error("This PPAP is closed — the customer approved the PSW.");
  if (element.pswDetail?.signedAt) throw new Error("The PSW is signed. Withdraw the signature to edit it.");
  return element;
}

const REASON_CODES = PSW_REASONS.map((r) => r.code) as [string, ...string[]];

const pswSchema = z.object({
  safetyGovRegulation: z.enum(["Y", "N"]).nullable(),
  poNumber: z.string().nullable(),
  checkingAidNo: z.string().nullable(),
  checkingAidEcl: z.string().nullable(),
  checkingAidEclDate: z.string().nullable(),
  reasons: z.array(z.enum(REASON_CODES)),
  otherReasonText: z.string().nullable(),
  resultsMeetRequirements: z.enum(["Y", "N"]).nullable(),
  explanation: z.string().nullable(),
  productionRateQty: z.string().nullable(),
  productionRateHours: z.string().nullable(),
  printName: z.string().nullable(),
  title: z.string().nullable(),
  phone: z.string().nullable(),
});

function str(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export async function savePsw(ppapElementId: string, formData: FormData) {
  const userId = await requireUserId();
  const element = await loadEditable(ppapElementId);
  const p = pswSchema.parse({
    ...Object.fromEntries(Object.keys(pswSchema.shape).filter((k) => k !== "reasons").map((k) => [k, str(formData, k)])),
    reasons: formData.getAll("reasons").map(String),
  });
  const data = {
    safetyGovRegulation: p.safetyGovRegulation === "Y" ? true : p.safetyGovRegulation === "N" ? false : null,
    poNumber: p.poNumber,
    checkingAidNo: p.checkingAidNo,
    checkingAidEcl: p.checkingAidEcl,
    checkingAidEclDate: p.checkingAidEclDate ? new Date(`${p.checkingAidEclDate}T00:00:00.000Z`) : null,
    submittalDimensional: formData.get("submittalDimensional") === "on",
    submittalMaterials: formData.get("submittalMaterials") === "on",
    submittalAppearance: formData.get("submittalAppearance") === "on",
    reasons: p.reasons,
    otherReasonText: p.reasons.includes("OTHER") ? p.otherReasonText : null,
    resultsMeetRequirements: p.resultsMeetRequirements === "Y" ? true : p.resultsMeetRequirements === "N" ? false : null,
    explanation: p.explanation,
    productionRateQty: p.productionRateQty,
    productionRateHours: p.productionRateHours,
    printName: p.printName,
    title: p.title,
    phone: p.phone,
  };
  const before = element.pswDetail;
  const after = await prisma.pswDetail.upsert({ where: { ppapElementId }, update: data, create: { ppapElementId, ...data } });
  if (element.status === "NOT_STARTED") await prisma.ppapElement.update({ where: { id: ppapElementId }, data: { status: "IN_PROGRESS" } });
  await audit({ userId, ppapId: element.ppapId, action: before ? "UPDATE" : "CREATE", entityType: "PswDetail", entityId: after.id, before, after });
  revalidatePsw(element.ppapId);
}

/**
 * Supplier authorised e-signature. Enforced here (not just by the disabled
 * button): every REQUIRED element must be approved and the warrant
 * complete. Signing submits the PSW and the PPAP.
 */
export async function signPsw(ppapElementId: string) {
  const userId = (await assertCan("signPsw", "Only a QA Manager or Admin can sign the PSW.")).id;
  const element = await loadEditable(ppapElementId);
  const elements = await prisma.ppapElement.findMany({ where: { ppapId: element.ppapId } });
  const gate = pswReadiness(elements);
  if (!gate.ready) {
    throw new Error(`Not ready to sign — still to approve: ${gate.missing.map((m) => `${m.elementNo}. ${PPAP_ELEMENT_NAMES[m.elementNo]}`).join("; ")}.`);
  }
  const detail = element.pswDetail;
  if (!detail) throw new Error("Fill in and save the warrant before signing.");
  const errors = pswSignErrors(detail);
  if (errors.length) throw new Error(errors.join(" "));
  // Pre-submission data-consistency checks: errors block the signature.
  const blocking = (await runConsistencyChecks(element.ppapId)).filter((i) => i.severity === "ERROR");
  if (blocking.length) {
    throw new Error(`Fix before signing — ${blocking.map((i) => `${i.elementNo !== null ? `${i.elementNo}. ` : ""}${i.message}`).join(" ")}`);
  }

  const now = new Date();
  // Re-submitting after a rejection: the customer dispositions the new
  // submission afresh (the rejected one stays in the audit log).
  const previous = await prisma.customerDisposition.findUnique({ where: { ppapElementId } });
  if (previous?.status) {
    await prisma.customerDisposition.update({ where: { id: previous.id }, data: { status: null, signedFileUrl: null, signedFileName: null, customerSignatureDate: null } });
    await audit({ userId, ppapId: element.ppapId, action: "UPDATE", entityType: "CustomerDisposition", entityId: previous.id, before: previous, after: { event: "Reset for re-submitted PSW" } });
  }
  const after = await prisma.pswDetail.update({ where: { id: detail.id }, data: { signedById: userId, signedAt: now } });
  await prisma.ppapElement.update({ where: { id: ppapElementId }, data: { status: "SUBMITTED" } });
  await prisma.ppap.update({ where: { id: element.ppapId }, data: { status: "SUBMITTED", statusChangedAt: now, submissionDate: now } });
  await audit({ userId, ppapId: element.ppapId, action: "APPROVE", entityType: "PswDetail", entityId: detail.id, before: detail, after: { ...after, event: "PSW signed — PPAP submitted" } });
  revalidatePsw(element.ppapId);
}

/** Take the signature back (only before the customer has dispositioned the PSW). */
export async function withdrawPswSignature(ppapElementId: string) {
  const userId = await requireUserId();
  const element = await prisma.ppapElement.findUniqueOrThrow({ where: { id: ppapElementId }, include: { ppap: true, pswDetail: true, customerDisposition: true } });
  if (element.ppap.status === "CLOSED") throw new Error("This PPAP is closed.");
  if (element.customerDisposition?.status) throw new Error("The customer has already dispositioned this PSW.");
  if (!element.pswDetail?.signedAt) return;
  const after = await prisma.pswDetail.update({ where: { id: element.pswDetail.id }, data: { signedById: null, signedAt: null } });
  await prisma.ppapElement.update({ where: { id: ppapElementId }, data: { status: "IN_PROGRESS" } });
  await prisma.ppap.update({ where: { id: element.ppapId }, data: { status: "OPEN", statusChangedAt: new Date() } });
  await audit({ userId, ppapId: element.ppapId, action: "UPDATE", entityType: "PswDetail", entityId: element.pswDetail.id, before: element.pswDetail, after: { ...after, event: "PSW signature withdrawn" } });
  revalidatePsw(element.ppapId);
}
