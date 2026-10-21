"use client";

import { useRef, useState, useTransition } from "react";
import { saveCustomerDisposition } from "@/lib/actions/customer-disposition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateIndia } from "@/lib/format";
import { submitFormData } from "@/lib/form";

export type CustomerDispositionData = {
  status: string | null;
  comments: string | null;
  customerName: string | null;
  customerDesignation: string | null;
  customerSignatureDate: Date | null;
  signedFileUrl: string | null;
  signedFileName: string | null;
  recordedByName: string | null;
};

function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export function CustomerDisposition({
  ppapElementId,
  approvalMode,
  canEdit,
  locked,
  disposition,
  statusLabels,
}: {
  ppapElementId: string;
  approvalMode: "CUSTOMER_PORTAL" | "SUPPLIER_UPLOAD";
  canEdit: boolean;
  locked: boolean;
  disposition: CustomerDispositionData | null;
  /** Sheet-specific wording, e.g. the PSW's "Other" for CONDITIONAL. */
  statusLabels?: Partial<Record<"APPROVED" | "REJECTED" | "CONDITIONAL", string>>;
}) {
  const labels = { APPROVED: "Approved", REJECTED: "Rejected", CONDITIONAL: "Conditional", ...statusLabels };
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await saveCustomerDisposition(ppapElementId, formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save.");
      }
    });
  }

  const editable = canEdit && !locked;

  if (!editable) {
    return (
      <div className="space-y-2 rounded-md border p-3 text-sm">
        {!canEdit ? (
          <p className="text-xs text-muted-foreground">
            {approvalMode === "CUSTOMER_PORTAL"
              ? "Read-only — only that customer's approver can record this disposition."
              : "Read-only."}
          </p>
        ) : null}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">Status</dt>
          <dd>{disposition?.status ? labels[disposition.status as keyof typeof labels] ?? disposition.status : "—"}</dd>
          <dt className="text-muted-foreground">Comments</dt>
          <dd>{disposition?.comments ?? "—"}</dd>
          <dt className="text-muted-foreground">Customer Name</dt>
          <dd>{disposition?.customerName ?? "—"}</dd>
          <dt className="text-muted-foreground">Designation</dt>
          <dd>{disposition?.customerDesignation ?? "—"}</dd>
          <dt className="text-muted-foreground">Date</dt>
          <dd>{disposition?.customerSignatureDate ? formatDateIndia(disposition.customerSignatureDate) : "—"}</dd>
        </dl>
        {disposition?.signedFileUrl ? (
          <p>
            <a href={disposition.signedFileUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
              {disposition.signedFileName ?? "Signed copy"}
            </a>
            {disposition.recordedByName ? (
              <span className="text-muted-foreground"> — recorded by {disposition.recordedByName} from signed copy</span>
            ) : null}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={submitFormData(handleSubmit)} className="space-y-3 rounded-md border p-3">
      {approvalMode === "SUPPLIER_UPLOAD" && disposition?.signedFileUrl ? (
        <p className="text-sm">
          Recorded by {disposition.recordedByName ?? "—"} from signed copy —{" "}
          <a href={disposition.signedFileUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            {disposition.signedFileName}
          </a>
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="cd-status">Status</Label>
          <select
            id="cd-status"
            name="status"
            defaultValue={disposition?.status ?? ""}
            className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="">— Not set —</option>
            <option value="APPROVED">{labels.APPROVED}</option>
            <option value="REJECTED">{labels.REJECTED}</option>
            <option value="CONDITIONAL">{labels.CONDITIONAL}</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="cd-date">Date</Label>
          <Input id="cd-date" name="customerSignatureDate" type="date" defaultValue={toDateInputValue(disposition?.customerSignatureDate ?? null)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="cd-customer-name">Customer Name</Label>
          <Input id="cd-customer-name" name="customerName" defaultValue={disposition?.customerName ?? ""} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cd-customer-designation">Designation</Label>
          <Input id="cd-customer-designation" name="customerDesignation" defaultValue={disposition?.customerDesignation ?? ""} />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="cd-comments">Comments</Label>
        <Textarea id="cd-comments" name="comments" defaultValue={disposition?.comments ?? ""} />
      </div>

      {approvalMode === "SUPPLIER_UPLOAD" ? (
        <div className="space-y-1">
          <Label htmlFor="cd-file">
            Signed copy (PDF/scan) {!disposition?.signedFileUrl ? <span className="text-destructive">— required</span> : null}
          </Label>
          <Input id="cd-file" name="signedFile" type="file" />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          You are recording this as the customer&apos;s approver (customer-portal mode).
        </p>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Saving..." : "Save disposition"}
      </Button>
    </form>
  );
}
