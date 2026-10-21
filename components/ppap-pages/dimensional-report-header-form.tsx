"use client";

import { useRef, useTransition } from "react";
import { saveDimensionalReportHeader } from "@/lib/actions/dimensional-report";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Prisma } from "@/app/generated/prisma/client";

type Detail = Prisma.DimensionalReportDetailGetPayload<object> | null;

function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export function DimensionalReportHeaderForm({
  ppapElementId,
  locked,
  detail,
  master,
}: {
  ppapElementId: string;
  locked: boolean;
  detail: Detail;
  master: { customerName: string; drawingNumber: string; partName: string };
}) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await saveDimensionalReportHeader(ppapElementId, formData);
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-3 rounded-md border p-3">
      <dl className="grid grid-cols-3 gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Customer</dt>
        <dd className="col-span-2">{master.customerName}</dd>
        <dt className="text-muted-foreground">Drawing Number</dt>
        <dd className="col-span-2">{master.drawingNumber}</dd>
        <dt className="text-muted-foreground">Part Name</dt>
        <dd className="col-span-2">{master.partName}</dd>
      </dl>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="reportDate">Date</Label>
          <Input id="reportDate" name="reportDate" type="date" defaultValue={toDateInputValue(detail?.reportDate)} disabled={locked} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="reportSlNo">Sl No</Label>
          <Input id="reportSlNo" name="reportSlNo" defaultValue={detail?.reportSlNo ?? ""} disabled={locked} />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="comments">Comments</Label>
        <Textarea id="comments" name="comments" defaultValue={detail?.comments ?? ""} disabled={locked} className="h-16" />
      </div>

      {!locked ? (
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save Header"}
        </Button>
      ) : null}
    </form>
  );
}
