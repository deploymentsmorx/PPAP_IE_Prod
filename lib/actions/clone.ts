"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertSupplierUser } from "@/lib/permissions";
import { clonePpap, type CloneTarget } from "@/lib/clone-ppap";

const schema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("revision"), revision: z.string().trim().min(1, "Enter the new revision letter"), drawingNo: z.string().trim().optional() }),
  z.object({
    mode: z.literal("part"),
    customerMode: z.enum(["existing", "new"]),
    customerId: z.string().optional(),
    newCustomerName: z.string().trim().optional(),
    partName: z.string().trim().min(1, "Enter the part name"),
    partNumber: z.string().trim().min(1, "Enter the part number"),
    revision: z.string().trim().min(1, "Enter the revision letter"),
    drawingNo: z.string().trim().optional(),
  }),
]);

/** Deep-clones a PPAP (see lib/clone-ppap.ts) and opens the copy. */
export async function clonePpapAction(sourcePpapId: string, formData: FormData) {
  const user = await assertSupplierUser();
  const raw = Object.fromEntries(formData.entries());
  const data = schema.parse(raw);
  const approvalMode = raw.approvalMode === "CUSTOMER_PORTAL" || raw.approvalMode === "SUPPLIER_UPLOAD" ? raw.approvalMode : undefined;

  let target: CloneTarget;
  if (data.mode === "revision") {
    target = { mode: "revision", revision: data.revision, drawingNo: data.drawingNo || null };
  } else {
    if (data.customerMode === "new" && !data.newCustomerName) throw new Error("Enter the new customer's name");
    target = {
      mode: "part",
      customerId: data.customerMode === "existing" ? data.customerId || null : null,
      newCustomerName: data.customerMode === "new" ? data.newCustomerName! : null,
      partName: data.partName,
      partNumber: data.partNumber,
      revision: data.revision,
      drawingNo: data.drawingNo || null,
    };
  }
  const ppap = await clonePpap(sourcePpapId, target, { approvalMode, userId: user.id });
  revalidatePath("/");
  redirect(`/ppap/${ppap.id}/0`);
}
