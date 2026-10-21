"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertSupplierUser } from "@/lib/permissions";
import { saveUploadedFile } from "@/lib/storage";
import { imageSize } from "@/lib/image-size";
import { parseAnnotations } from "@/lib/calc/csr";

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

function str(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function revalidateCsrEverywhere() {
  revalidatePath("/csr");
  // Element 17 (and AAR's CSR-derived criteria) on every PPAP of the customer.
  revalidatePath("/(app)/ppap/[id]/[element]", "page");
  revalidatePath("/(print)/ppap/[id]/[element]/print", "page");
}

async function assertEditable(ppapElementId: string) {
  await assertSupplierUser();
  const element = await prisma.ppapElement.findUniqueOrThrow({ where: { id: ppapElementId } });
  if (element.status === "APPROVED") throw new Error("This page is approved and locked. Use Revise to edit it.");
  return element;
}

function revalidateElement17(ppapId: string) {
  revalidatePath(`/ppap/${ppapId}/17`);
  revalidatePath(`/ppap/${ppapId}/17/print`);
  revalidatePath(`/ppap/${ppapId}`);
}

// ---------------------------------------------------------------------------
// CSR library (per customer)
// ---------------------------------------------------------------------------

const sectionSchema = z.object({
  code: z.string().min(1, "Code is required").max(10),
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable(),
  isZone: z.boolean(),
  colour: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colour must be like #4472C4").nullable(),
  sortOrder: z.preprocess((v) => (v == null ? 0 : Number(v)), z.number().int()),
});

export async function saveCsrSection(sectionId: string | null, customerId: string, formData: FormData) {
  const userId = await requireUserId();
  const parsed = sectionSchema.parse({
    code: str(formData, "code"),
    title: str(formData, "title"),
    description: str(formData, "description"),
    isZone: formData.get("isZone") === "on",
    colour: str(formData, "colour"),
    sortOrder: str(formData, "sortOrder"),
  });
  const clash = await prisma.csrSection.findUnique({ where: { customerId_code: { customerId, code: parsed.code } } });
  if (clash && clash.id !== sectionId) throw new Error(`Section "${parsed.code}" already exists for this customer.`);

  const image: { imageUrl?: string; imageName?: string } = {};
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    const saved = await saveUploadedFile(file, `csr/${customerId}`);
    image.imageUrl = saved.url;
    image.imageName = saved.fileName;
  }

  if (sectionId) {
    const before = await prisma.csrSection.findUniqueOrThrow({ where: { id: sectionId } });
    const after = await prisma.csrSection.update({ where: { id: sectionId }, data: { ...parsed, ...image } });
    await audit({ userId, action: "UPDATE", entityType: "CsrSection", entityId: sectionId, before, after });
  } else {
    const after = await prisma.csrSection.create({ data: { customerId, ...parsed, ...image } });
    await audit({ userId, action: "CREATE", entityType: "CsrSection", entityId: after.id, before: null, after });
  }
  revalidateCsrEverywhere();
}

/** A requirement with assessed compliance on any PPAP can't be deleted (that would erase PPAP records). */
async function assertNoAssessedCompliance(where: { requirementId?: string; requirement?: { sectionId: string } }, what: string) {
  const assessed = await prisma.csrCompliance.count({ where: { ...where, complied: { not: null } } });
  if (assessed > 0) throw new Error(`${what} has compliance recorded on ${assessed} PPAP row(s) and cannot be deleted.`);
}

export async function deleteCsrSection(sectionId: string) {
  const userId = await requireUserId();
  await assertNoAssessedCompliance({ requirement: { sectionId } }, "This section");
  const before = await prisma.csrSection.findUniqueOrThrow({ where: { id: sectionId }, include: { requirements: true } });
  await prisma.csrCompliance.deleteMany({ where: { requirement: { sectionId } } });
  await prisma.csrRequirement.deleteMany({ where: { sectionId } });
  await prisma.csrSection.delete({ where: { id: sectionId } });
  await audit({ userId, action: "DELETE", entityType: "CsrSection", entityId: sectionId, before, after: null });
  revalidateCsrEverywhere();
}

const requirementSchema = z.object({
  ruleNo: z.preprocess((v) => Number(v), z.number().int().min(1)),
  text: z.string().min(1, "Requirement text is required"),
  criteriaKey: z.enum(["GLOSS", "DFT", "VIEWING_DISTANCE"]).nullable(),
});

export async function saveCsrRequirement(requirementId: string | null, sectionId: string, formData: FormData) {
  const userId = await requireUserId();
  const parsed = requirementSchema.parse({ ruleNo: str(formData, "ruleNo"), text: str(formData, "text"), criteriaKey: str(formData, "criteriaKey") });
  if (requirementId) {
    const before = await prisma.csrRequirement.findUniqueOrThrow({ where: { id: requirementId } });
    const after = await prisma.csrRequirement.update({ where: { id: requirementId }, data: { ...parsed, sortOrder: parsed.ruleNo } });
    await audit({ userId, action: "UPDATE", entityType: "CsrRequirement", entityId: requirementId, before, after });
  } else {
    const after = await prisma.csrRequirement.create({ data: { sectionId, ...parsed, sortOrder: parsed.ruleNo } });
    await audit({ userId, action: "CREATE", entityType: "CsrRequirement", entityId: after.id, before: null, after });
  }
  revalidateCsrEverywhere();
}

export async function deleteCsrRequirement(requirementId: string) {
  const userId = await requireUserId();
  await assertNoAssessedCompliance({ requirementId }, "This requirement");
  await prisma.csrCompliance.deleteMany({ where: { requirementId } });
  const before = await prisma.csrRequirement.delete({ where: { id: requirementId } });
  await audit({ userId, action: "DELETE", entityType: "CsrRequirement", entityId: requirementId, before, after: null });
  revalidateCsrEverywhere();
}

// ---------------------------------------------------------------------------
// Compliance checklist (per PPAP)
// ---------------------------------------------------------------------------

/** Saves every row; inputs are `cmp-<id>-complied` ("Y"/"N"/""), `-evidenceElementNo`, `-remark`. */
export async function saveCsrCompliance(ppapElementId: string, formData: FormData) {
  const userId = await requireUserId();
  const element = await assertEditable(ppapElementId);
  const rows = await prisma.csrCompliance.findMany({ where: { ppapElementId } });
  for (const row of rows) {
    if (formData.get(`cmp-${row.id}-complied`) === null) continue;
    const compliedRaw = str(formData, `cmp-${row.id}-complied`);
    const evidenceRaw = str(formData, `cmp-${row.id}-evidenceElementNo`);
    const evidenceElementNo = evidenceRaw ? Number(evidenceRaw) : null;
    if (evidenceElementNo !== null && !(Number.isInteger(evidenceElementNo) && evidenceElementNo >= 0 && evidenceElementNo <= 18)) {
      throw new Error("Evidence must link to an element 0-18.");
    }
    const data = {
      complied: compliedRaw === "Y" ? true : compliedRaw === "N" ? false : null,
      evidenceElementNo,
      remark: str(formData, `cmp-${row.id}-remark`),
    };
    if (data.complied === row.complied && data.evidenceElementNo === row.evidenceElementNo && data.remark === row.remark) continue;
    const after = await prisma.csrCompliance.update({ where: { id: row.id }, data });
    await audit({ userId, ppapId: element.ppapId, action: "UPDATE", entityType: "CsrCompliance", entityId: row.id, before: row, after });
  }
  revalidateElement17(element.ppapId);
}

export async function uploadCsrEvidence(complianceId: string, ppapElementId: string, formData: FormData) {
  const userId = await requireUserId();
  const element = await assertEditable(ppapElementId);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("A file is required.");
  const saved = await saveUploadedFile(file, `ppap-elements/${ppapElementId}/csr-evidence`);
  const before = await prisma.csrCompliance.findUniqueOrThrow({ where: { id: complianceId } });
  const after = await prisma.csrCompliance.update({ where: { id: complianceId }, data: { evidenceFileUrl: saved.url, evidenceFileName: saved.fileName } });
  await audit({ userId, ppapId: element.ppapId, action: "UPDATE", entityType: "CsrCompliance", entityId: complianceId, before, after });
  revalidateElement17(element.ppapId);
}

// ---------------------------------------------------------------------------
// Zone maps (per PPAP)
// ---------------------------------------------------------------------------

export async function addZoneMapPage(ppapElementId: string) {
  const userId = await requireUserId();
  const element = await assertEditable(ppapElementId);
  const count = await prisma.csrZoneMapPage.count({ where: { ppapElementId } });
  const page = await prisma.csrZoneMapPage.create({ data: { ppapElementId, sortOrder: count } });
  await audit({ userId, ppapId: element.ppapId, action: "CREATE", entityType: "CsrZoneMapPage", entityId: page.id, before: null, after: page });
  revalidateElement17(element.ppapId);
}

export async function deleteZoneMapPage(pageId: string, ppapElementId: string) {
  const userId = await requireUserId();
  const element = await assertEditable(ppapElementId);
  const before = await prisma.csrZoneMapPage.findUniqueOrThrow({ where: { id: pageId }, include: { views: true } });
  await prisma.csrZoneMapView.deleteMany({ where: { pageId } });
  await prisma.csrZoneMapPage.delete({ where: { id: pageId } });
  await audit({ userId, ppapId: element.ppapId, action: "DELETE", entityType: "CsrZoneMapPage", entityId: pageId, before, after: null });
  revalidateElement17(element.ppapId);
}

/** Adds a picture ("view") to a zone-map page. */
export async function addZoneMapView(pageId: string, ppapElementId: string, formData: FormData) {
  const userId = await requireUserId();
  const element = await assertEditable(ppapElementId);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("A picture is required.");
  if (file.type && !file.type.startsWith("image/")) throw new Error("Zone maps need an image (PNG or JPEG).");
  const size = imageSize(new Uint8Array(await file.arrayBuffer()));
  const saved = await saveUploadedFile(file, `ppap-elements/${ppapElementId}/csr-zone-maps`);
  const count = await prisma.csrZoneMapView.count({ where: { pageId } });
  const view = await prisma.csrZoneMapView.create({
    data: {
      pageId,
      imageUrl: saved.url,
      imageName: saved.fileName,
      imageWidth: size?.width ?? null,
      imageHeight: size?.height ?? null,
      caption: str(formData, "caption"),
      sortOrder: count,
    },
  });
  await audit({ userId, ppapId: element.ppapId, action: "CREATE", entityType: "CsrZoneMapView", entityId: view.id, before: null, after: view });
  revalidateElement17(element.ppapId);
}

export async function deleteZoneMapView(viewId: string, ppapElementId: string) {
  const userId = await requireUserId();
  const element = await assertEditable(ppapElementId);
  const before = await prisma.csrZoneMapView.delete({ where: { id: viewId } });
  await audit({ userId, ppapId: element.ppapId, action: "DELETE", entityType: "CsrZoneMapView", entityId: viewId, before, after: null });
  revalidateElement17(element.ppapId);
}

/** Saves the drawn zones (validated) and caption of one view. */
export async function saveZoneMapView(viewId: string, ppapElementId: string, data: { caption: string | null; annotations: unknown }) {
  const userId = await requireUserId();
  const element = await assertEditable(ppapElementId);
  const annotations = parseAnnotations(data.annotations);
  const before = await prisma.csrZoneMapView.findUniqueOrThrow({ where: { id: viewId } });
  const after = await prisma.csrZoneMapView.update({
    where: { id: viewId },
    data: { caption: data.caption?.trim() || null, annotations: annotations as never },
  });
  await audit({ userId, ppapId: element.ppapId, action: "UPDATE", entityType: "CsrZoneMapView", entityId: viewId, before, after });
  revalidateElement17(element.ppapId);
}
