"use client";

import { useRef, useTransition } from "react";
import { saveRmtcHeader } from "@/lib/actions/rmtc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Decimal fields (thickness/width/lengthToleranceMm) are pre-converted to
// plain numbers by the caller — Prisma's Decimal class can't cross the
// server/client boundary as a component prop.
type Detail = {
  projectName: string | null;
  otherRef: string | null;
  codeNo: string | null;
  supplierName: string | null;
  thicknessToleranceMm: number | null;
  widthToleranceMm: number | null;
  lengthToleranceMm: number | null;
  reportRemarks: string | null;
  customerWitnessName: string | null;
  customerWitnessAt: Date | null;
} | null;

function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export function RmtcHeaderForm({
  ppapElementId,
  locked,
  detail,
  master,
}: {
  ppapElementId: string;
  locked: boolean;
  detail: Detail;
  master: { customerName: string; partName: string; partNumber: string; drawingRevNo: string };
}) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await saveRmtcHeader(ppapElementId, formData);
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-3 rounded-md border p-3">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        <dt className="text-muted-foreground">Customer</dt>
        <dd>{master.customerName}</dd>
        <dt className="text-muted-foreground">Drawing Rev. No.</dt>
        <dd>{master.drawingRevNo}</dd>
        <dt className="text-muted-foreground">Part Name</dt>
        <dd>{master.partName}</dd>
        <dt className="text-muted-foreground">Part Number</dt>
        <dd>{master.partNumber}</dd>
      </dl>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="projectName">Project Name</Label>
          <Input id="projectName" name="projectName" defaultValue={detail?.projectName ?? ""} disabled={locked} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="otherRef">Other ref. if any</Label>
          <Input id="otherRef" name="otherRef" defaultValue={detail?.otherRef ?? ""} disabled={locked} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="supplierName">Supplier Name</Label>
          <Input id="supplierName" name="supplierName" defaultValue={detail?.supplierName ?? ""} disabled={locked} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="codeNo">Code No</Label>
          <Input id="codeNo" name="codeNo" defaultValue={detail?.codeNo ?? ""} disabled={locked} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        <div className="space-y-1">
          <Label htmlFor="thicknessToleranceMm">Thickness tol. (mm)</Label>
          <Input
            id="thicknessToleranceMm"
            name="thicknessToleranceMm"
            type="number"
            step="0.01"
            min="0"
            defaultValue={detail?.thicknessToleranceMm != null ? String(detail.thicknessToleranceMm) : "0.3"}
            disabled={locked}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="widthToleranceMm">Width tol. (mm)</Label>
          <Input
            id="widthToleranceMm"
            name="widthToleranceMm"
            type="number"
            step="0.01"
            min="0"
            defaultValue={detail?.widthToleranceMm != null ? String(detail.widthToleranceMm) : "30"}
            disabled={locked}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="lengthToleranceMm">Length tol. (mm)</Label>
          <Input
            id="lengthToleranceMm"
            name="lengthToleranceMm"
            type="number"
            step="0.01"
            min="0"
            defaultValue={detail?.lengthToleranceMm != null ? String(detail.lengthToleranceMm) : "30"}
            disabled={locked}
          />
        </div>
        <div className="col-span-3 space-y-1 sm:col-span-3">
          <Label htmlFor="reportRemarks">Remarks</Label>
          <Textarea id="reportRemarks" name="reportRemarks" defaultValue={detail?.reportRemarks ?? ""} disabled={locked} className="h-10" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="customerWitnessName">Customer Witness (optional)</Label>
          <Input id="customerWitnessName" name="customerWitnessName" defaultValue={detail?.customerWitnessName ?? ""} disabled={locked} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="customerWitnessAt">Customer Witness Date</Label>
          <Input
            id="customerWitnessAt"
            name="customerWitnessAt"
            type="date"
            defaultValue={toDateInputValue(detail?.customerWitnessAt)}
            disabled={locked}
          />
        </div>
      </div>

      {!locked ? (
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save Header"}
        </Button>
      ) : null}
    </form>
  );
}
