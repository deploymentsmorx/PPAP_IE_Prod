"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertSupplierUser } from "@/lib/permissions";
import { saveUploadedFile } from "@/lib/storage";
import { updatePartMaster, updateCustomerName, updatePartRevisionMaster } from "@/lib/master-data";

async function assertEditable(ppapElementId: string) {
  await assertSupplierUser();
  const element = await prisma.ppapElement.findUniqueOrThrow({ where: { id: ppapElementId } });
  if (element.status === "APPROVED") {
    throw new Error("This page is approved and locked. Use Revise to edit it.");
  }
  return element;
}

function revalidateElement(ppapId: string, elementNo: number) {
  revalidatePath(`/ppap/${ppapId}/${elementNo}`);
  revalidatePath(`/ppap/${ppapId}/${elementNo}/print`);
}

const detailSchema = z.object({
  partNameRemarks: z.string().optional(),
  partNumberRemarks: z.string().optional(),
  customerNameRemarks: z.string().optional(),
  drawingNumberRemarks: z.string().optional(),
  drawingRevisionRemarks: z.string().optional(),
  // The <select> submits "" when nothing is chosen; treat that as unset
  // rather than passing "" to a foreign key column.
  materialSpecId: z.string().optional().transform((v) => (v ? v : undefined)),
  materialSpecRemarks: z.string().optional(),
  heatTreatment: z.string().optional(),
  heatTreatmentRemarks: z.string().optional(),
  surfaceFinish: z.string().optional(),
  surfaceFinishRemarks: z.string().optional(),
  specialCharacteristicsRemarks: z.string().optional(),
});

// Master-record fields shown read-only-no-more on this page. Submitted
// alongside the remarks in the same form, but written through to
// Part/Customer/PartRevision — see lib/master-data.ts.
const masterSchema = z.object({
  partId: z.string().min(1),
  partName: z.string().min(1),
  partNumber: z.string().min(1),
  customerId: z.string().min(1),
  customerName: z.string().min(1),
  partRevisionId: z.string().min(1),
  drawingNumber: z.string().min(1),
  drawingRevision: z.string().min(1),
});

export async function updateDesignRecordDetail(ppapElementId: string, formData: FormData) {
  const element = await assertEditable(ppapElementId);
  const raw = Object.fromEntries(formData.entries());
  const data = detailSchema.parse(raw);
  const master = masterSchema.parse(raw);

  await prisma.designRecordDetail.upsert({
    where: { ppapElementId },
    update: data,
    create: { ppapElementId, ...data },
  });

  await updatePartMaster(master.partId, { partName: master.partName, partNumber: master.partNumber });
  await updateCustomerName(master.customerId, master.customerName);
  await updatePartRevisionMaster(master.partRevisionId, {
    drawingNo: master.drawingNumber,
    revision: master.drawingRevision,
  });

  revalidateElement(element.ppapId, element.elementNo);
  // Part/customer/drawing-revision names appear on the PPAP list too.
  revalidatePath("/");
}

const specialCharSchema = z.object({
  id: z.string().optional(),
  characteristic: z.string().min(1),
  charClass: z.enum(["CRITICAL", "MAJOR"]),
  symbol: z.string().optional(),
  drawingRef: z.string().optional(),
});

export async function upsertSpecialCharacteristic(
  ppapElementId: string,
  input: z.infer<typeof specialCharSchema>,
) {
  const element = await assertEditable(ppapElementId);
  const data = specialCharSchema.parse(input);

  if (data.id) {
    await prisma.specialCharacteristic.update({
      where: { id: data.id },
      data: {
        characteristic: data.characteristic,
        charClass: data.charClass,
        symbol: data.symbol,
        drawingRef: data.drawingRef,
      },
    });
  } else {
    const count = await prisma.specialCharacteristic.count({ where: { ppapElementId } });
    await prisma.specialCharacteristic.create({
      data: {
        ppapElementId,
        characteristic: data.characteristic,
        charClass: data.charClass,
        symbol: data.symbol,
        drawingRef: data.drawingRef,
        sortOrder: count,
      },
    });
  }

  revalidateElement(element.ppapId, element.elementNo);
}

export async function deleteSpecialCharacteristic(ppapElementId: string, id: string) {
  const element = await assertEditable(ppapElementId);
  await prisma.specialCharacteristic.delete({ where: { id } });
  revalidateElement(element.ppapId, element.elementNo);
}

export async function uploadDrawingFile(ppapElementId: string, formData: FormData) {
  const element = await assertEditable(ppapElementId);
  const file = formData.get("file");
  const revision = String(formData.get("revision") ?? "").trim();
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("A file is required");
  }
  if (!revision) {
    throw new Error("A revision label is required");
  }

  const saved = await saveUploadedFile(file, `ppap-elements/${ppapElementId}/drawings`);

  await prisma.$transaction([
    prisma.drawingFile.updateMany({
      where: { ppapElementId, status: "ACTIVE" },
      data: { status: "SUPERSEDED" },
    }),
    prisma.drawingFile.create({
      data: {
        ppapElementId,
        revision,
        fileUrl: saved.url,
        fileName: saved.fileName,
        fileType: saved.fileType,
        status: "ACTIVE",
      },
    }),
  ]);

  revalidateElement(element.ppapId, element.elementNo);
}

export async function deleteDrawingFile(ppapElementId: string, id: string) {
  const element = await assertEditable(ppapElementId);
  await prisma.drawingFile.delete({ where: { id } });
  revalidateElement(element.ppapId, element.elementNo);
}

export async function renameDrawingFileRevision(ppapElementId: string, id: string, revision: string) {
  const element = await assertEditable(ppapElementId);
  const trimmed = revision.trim();
  if (!trimmed) {
    throw new Error("A revision label is required");
  }
  await prisma.drawingFile.update({ where: { id }, data: { revision: trimmed } });
  revalidateElement(element.ppapId, element.elementNo);
}

export async function uploadBallooningImage(ppapElementId: string, formData: FormData) {
  const element = await assertEditable(ppapElementId);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("A file is required");
  }

  const saved = await saveUploadedFile(file, `ppap-elements/${ppapElementId}/ballooning`);

  await prisma.designRecordDetail.upsert({
    where: { ppapElementId },
    update: { ballooningImageUrl: saved.url, ballooningImageName: saved.fileName },
    create: { ppapElementId, ballooningImageUrl: saved.url, ballooningImageName: saved.fileName },
  });

  revalidateElement(element.ppapId, element.elementNo);
}

export async function removeBallooningImage(ppapElementId: string) {
  const element = await assertEditable(ppapElementId);
  await prisma.designRecordDetail.upsert({
    where: { ppapElementId },
    update: { ballooningImageUrl: null, ballooningImageName: null },
    create: { ppapElementId },
  });
  revalidateElement(element.ppapId, element.elementNo);
}

const balloonSchema = z.object({
  id: z.string().optional(),
  balloonNo: z.coerce.number().int().positive(),
  viewSection: z.string().optional(),
  description: z.string().optional(),
  nominal: z.string().optional(),
  tolerance: z.string().optional(),
});

export async function upsertBalloon(ppapElementId: string, input: z.infer<typeof balloonSchema>) {
  const element = await assertEditable(ppapElementId);
  const data = balloonSchema.parse(input);

  if (data.id) {
    await prisma.balloon.update({
      where: { id: data.id },
      data: {
        balloonNo: data.balloonNo,
        viewSection: data.viewSection,
        description: data.description,
        nominal: data.nominal,
        tolerance: data.tolerance,
      },
    });
  } else {
    const count = await prisma.balloon.count({ where: { ppapElementId } });
    await prisma.balloon.create({
      data: {
        ppapElementId,
        balloonNo: data.balloonNo,
        viewSection: data.viewSection,
        description: data.description,
        nominal: data.nominal,
        tolerance: data.tolerance,
        sortOrder: count,
      },
    });
  }

  revalidateElement(element.ppapId, element.elementNo);
}

export async function deleteBalloon(ppapElementId: string, id: string) {
  const element = await assertEditable(ppapElementId);
  await prisma.balloon.delete({ where: { id } });
  revalidateElement(element.ppapId, element.elementNo);
}
