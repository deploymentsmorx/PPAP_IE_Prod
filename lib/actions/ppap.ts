"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createPpapElements } from "@/lib/ppap";
import { assertSupplierUser } from "@/lib/permissions";

const createPpapSchema = z.object({
  customerMode: z.enum(["existing", "new"]),
  customerId: z.string().optional(),
  newCustomerName: z.string().optional(),

  partMode: z.enum(["existing", "new"]),
  partId: z.string().optional(),
  newPartName: z.string().optional(),
  newPartNumber: z.string().optional(),
  newProjectModel: z.string().optional(),
  newMaterialSpecId: z.string().optional(),

  revisionMode: z.enum(["existing", "new"]),
  partRevisionId: z.string().optional(),
  newRevision: z.string().optional(),
  newDrawingNo: z.string().optional(),

  level: z.coerce.number().int().min(1).max(5),
  reasonForSubmission: z.string().optional(),
  submissionDate: z.string().optional(),
  approvalMode: z.enum(["CUSTOMER_PORTAL", "SUPPLIER_UPLOAD"]),
});

export async function createPpap(formData: FormData) {
  await assertSupplierUser();
  const raw = Object.fromEntries(formData.entries());
  const data = createPpapSchema.parse(raw);

  let customerId: string;
  if (data.customerMode === "existing") {
    if (!data.customerId) throw new Error("Select a customer");
    customerId = data.customerId;
  } else {
    if (!data.newCustomerName?.trim()) throw new Error("Enter a customer name");
    const customer = await prisma.customer.create({
      data: { name: data.newCustomerName.trim(), approvalMode: data.approvalMode },
    });
    customerId = customer.id;
  }

  let partId: string;
  if (data.partMode === "existing") {
    if (!data.partId) throw new Error("Select a part");
    partId = data.partId;
  } else {
    if (!data.newPartName?.trim() || !data.newPartNumber?.trim()) {
      throw new Error("Enter a part name and part number");
    }
    const part = await prisma.part.create({
      data: {
        partName: data.newPartName.trim(),
        partNumber: data.newPartNumber.trim(),
        customerId,
        projectModel: data.newProjectModel?.trim() || null,
        materialSpecId: data.newMaterialSpecId || null,
      },
    });
    partId = part.id;
  }

  let partRevisionId: string;
  if (data.revisionMode === "existing") {
    if (!data.partRevisionId) throw new Error("Select a part revision");
    partRevisionId = data.partRevisionId;
  } else {
    if (!data.newRevision?.trim()) throw new Error("Enter a revision letter");
    const partRevision = await prisma.partRevision.create({
      data: {
        partId,
        revision: data.newRevision.trim(),
        drawingNo: data.newDrawingNo?.trim() || null,
        status: "ACTIVE",
      },
    });
    partRevisionId = partRevision.id;
  }

  const ppap = await prisma.ppap.create({
    data: {
      partRevisionId,
      customerId,
      level: data.level,
      reasonForSubmission: data.reasonForSubmission?.trim() || null,
      submissionDate: data.submissionDate ? new Date(data.submissionDate) : null,
      approvalMode: data.approvalMode,
    },
  });

  await createPpapElements(ppap.id, data.level);

  revalidatePath("/");
  redirect(`/ppap/${ppap.id}`);
}
