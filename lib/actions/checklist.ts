"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertSupplierUser } from "@/lib/permissions";
import { PPAP_ELEMENT_NUMBERS } from "@/lib/constants/ppap-elements";
import { parseChecklistRequired, checklistDisagrees } from "@/lib/calc/checklist";
import { applyChecklistApplicability } from "@/lib/checklist-sync";
import { assertPpapOpen } from "@/lib/psw-lifecycle";

async function assertEditable(ppapId: string) {
  await assertSupplierUser();
  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { ppapId_elementNo: { ppapId, elementNo: 0 } },
  });
  if (element.status === "APPROVED") {
    throw new Error("This page is approved and locked. Use Revise to edit it.");
  }
  await assertPpapOpen(ppapId);
  return element;
}

const CHECKLIST_ELEMENT_NUMBERS = PPAP_ELEMENT_NUMBERS.filter((n) => n >= 1 && n <= 18);

/**
 * Saves the free-text checklist. A Required cell the user actually changed
 * to a clear Y/N value also flips that page's applicability (two-way sync —
 * see lib/checklist-sync.ts); unchanged cells never touch the page, so
 * saving remarks can't undo an N/A set on the page itself. Approved
 * (locked) pages are skipped and reported back.
 */
export async function saveChecklist(ppapId: string, formData: FormData): Promise<{ skippedLocked: number[]; synced: number[] }> {
  await assertEditable(ppapId);

  const [existingRows, elements] = await Promise.all([
    prisma.checklistRow.findMany({ where: { ppapId } }),
    prisma.ppapElement.findMany({ where: { ppapId, elementNo: { in: CHECKLIST_ELEMENT_NUMBERS } } }),
  ]);
  const previousRequired = new Map(existingRows.map((r) => [r.elementNo, r.requiredOverride ?? ""]));
  const elementByNo = new Map(elements.map((e) => [e.elementNo, e]));

  const skippedLocked: number[] = [];
  const synced: number[] = [];

  for (const elementNo of CHECKLIST_ELEMENT_NUMBERS) {
    const data = {
      requiredOverride: (formData.get(`required-${elementNo}`) as string | null) ?? null,
      statusOverride: (formData.get(`status-${elementNo}`) as string | null) ?? null,
      remarks: (formData.get(`remarks-${elementNo}`) as string | null) ?? null,
      docRefLabel: (formData.get(`docref-${elementNo}`) as string | null) ?? null,
    };

    await prisma.checklistRow.upsert({
      where: { ppapId_elementNo: { ppapId, elementNo } },
      update: data,
      create: { ppapId, elementNo, ...data },
    });

    const changed = (data.requiredOverride ?? "").trim() !== (previousRequired.get(elementNo) ?? "").trim();
    const parsed = parseChecklistRequired(data.requiredOverride);
    const element = elementByNo.get(elementNo);
    if (!changed || !parsed || !element || !checklistDisagrees(parsed, element.applicability)) continue;

    if (element.status === "APPROVED") {
      skippedLocked.push(elementNo);
      continue;
    }
    await applyChecklistApplicability(element.id, parsed);
    synced.push(elementNo);
    revalidatePath(`/ppap/${ppapId}/${elementNo}`);
    revalidatePath(`/ppap/${ppapId}/${elementNo}/print`);
  }

  revalidatePath(`/ppap/${ppapId}/0`);
  revalidatePath(`/ppap/${ppapId}/0/print`);
  revalidatePath(`/ppap/${ppapId}`);
  return { skippedLocked, synced };
}
