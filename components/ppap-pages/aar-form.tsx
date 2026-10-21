"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveAar,
  addAarCriteriaRow,
  deleteAarCriteriaRow,
  pullAarLabResults,
  applyAarCsrCriteria,
  uploadAarPhoto,
  deleteAarPhoto,
} from "@/lib/actions/aar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitFormData } from "@/lib/form";
import type { Prisma } from "@/app/generated/prisma/client";

type Detail = Prisma.AarDetailGetPayload<object> | null;
type Row = Prisma.AarCriteriaRowGetPayload<{ include: { photos: true } }>;

function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

const SUBMISSION_REASONS = [
  { value: "NEW_PART", label: "New Part" },
  { value: "ENGINEERING_CHANGE", label: "Engineering Change" },
  { value: "TOOLING_CHANGE", label: "Tooling Change" },
  { value: "SUPPLIER_CHANGE", label: "Supplier Change" },
  { value: "OTHER", label: "Other (Specify)" },
] as const;

const PRODUCTION_CONDITIONS = [
  { value: "PROTOTYPE", label: "Prototype" },
  { value: "TRIAL_RUN", label: "Trial Run" },
  { value: "MASS_PRODUCTION", label: "Mass Production" },
] as const;

const OVERALL_RESULTS = [
  { value: "APPROVED", label: "Approved" },
  { value: "CONDITIONALLY_APPROVED", label: "Conditionally Approved" },
  { value: "REJECTED", label: "Rejected" },
] as const;

export function AarForm({
  ppapElementId,
  locked,
  master,
  detail,
  rows,
  labResults,
  sppSampleIds,
}: {
  ppapElementId: string;
  locked: boolean;
  master: {
    supplierName: string;
    supplierCode: string | null;
    customerName: string;
    partName: string;
    partNumber: string;
    revision: string;
    level: number;
  };
  detail: Detail;
  rows: Row[];
  labResults: Partial<Record<"DFT" | "ADHESION" | "GLOSS", string>>;
  /** Sample IDs registered on 14. Sample Production Part — default when this AAR has none of its own. */
  sppSampleIds: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [submissionReason, setSubmissionReason] = useState<string>(detail?.submissionReason ?? "");
  const [overallResult, setOverallResult] = useState<string>(detail?.overallResult ?? "");

  function handleSubmit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      try {
        await saveAar(ppapElementId, formData);
        setMessage("Saved.");
        router.refresh();
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Could not save.");
      }
    });
  }

  function handleAddRow() {
    startTransition(async () => {
      await addAarCriteriaRow(ppapElementId);
      router.refresh();
    });
  }

  function handleApplyCsr() {
    setMessage(null);
    startTransition(async () => {
      const { updated } = await applyAarCsrCriteria(ppapElementId);
      setMessage(updated ? `Applied CSR criteria to ${updated} row(s).` : "Rows already match the CSR (or the customer has no CSR zones).");
      router.refresh();
    });
  }

  function handlePullLab() {
    setMessage(null);
    startTransition(async () => {
      const { updated } = await pullAarLabResults(ppapElementId);
      setMessage(updated ? `Updated ${updated} result(s) from Lab Reports.` : "Results already match the latest Lab Reports.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submitFormData(handleSubmit)} className="space-y-6">
      {/* 1. Header */}
      <section className="space-y-3 rounded-md border p-3">
        <h3 className="text-sm font-semibold">1. Header Information</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Supplier Name</dt>
          <dd>{master.supplierName}</dd>
          <dt className="text-muted-foreground">Supplier Code</dt>
          <dd>{master.supplierCode ?? "—"}</dd>
          <dt className="text-muted-foreground">Customer Name</dt>
          <dd>{master.customerName}</dd>
          <dt className="text-muted-foreground">Part Name</dt>
          <dd>{master.partName}</dd>
          <dt className="text-muted-foreground">Part Number</dt>
          <dd>{master.partNumber}</dd>
          <dt className="text-muted-foreground">Revision Level</dt>
          <dd>{master.revision}</dd>
          <dt className="text-muted-foreground">Submission Level</dt>
          <dd>Level-{master.level}</dd>
        </dl>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="aar-reportDate">Date</Label>
            <Input id="aar-reportDate" name="reportDate" type="date" defaultValue={toDateInputValue(detail?.reportDate)} disabled={locked} />
          </div>
        </div>
        <fieldset className="space-y-1" disabled={locked}>
          <legend className="text-sm font-medium">Reason for Submission</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {SUBMISSION_REASONS.map((r) => (
              <label key={r.value} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="submissionReason"
                  value={r.value}
                  checked={submissionReason === r.value}
                  onChange={() => setSubmissionReason(r.value)}
                />
                {r.label}
              </label>
            ))}
          </div>
          {submissionReason === "OTHER" ? (
            <Input
              name="submissionReasonOther"
              aria-label="Other reason"
              placeholder="Specify reason"
              defaultValue={detail?.submissionReasonOther ?? ""}
              className="mt-1 max-w-md"
            />
          ) : null}
        </fieldset>
      </section>

      {/* 2. Appearance criteria */}
      <section className="space-y-3 rounded-md border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">2. Appearance Criteria Details</h3>
          {!locked ? (
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handleApplyCsr}>
                Apply CSR criteria
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handlePullLab}>
                Pull results from Lab Reports
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handleAddRow}>
                + Add parameter
              </Button>
            </div>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="w-10 p-1">Sl.</th>
                <th className="p-1">Appearance Parameter</th>
                <th className="p-1">Specification / Standard</th>
                <th className="p-1">Evaluation Method</th>
                <th className="p-1">Acceptance Criteria</th>
                <th className="p-1">Result</th>
                <th className="w-48 p-1">Photo Evidence</th>
                {!locked ? <th className="w-10 p-1" /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <CriteriaRow
                  key={row.id}
                  index={i + 1}
                  row={row}
                  ppapElementId={ppapElementId}
                  locked={locked}
                  labValue={row.labPaintProperty && row.labPaintProperty !== "VISUAL" ? labResults[row.labPaintProperty] : undefined}
                />
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Acceptance criteria pre-fill from the customer&apos;s 17. CSR zone A (gloss, DFT, viewing distance). Paint
          Thickness, Coating Adhesion and Gloss Level results come from 12. Lab Reports. Sample IDs default from 14.
          Sample Production Part.
        </p>
      </section>

      {/* 3. Sample information */}
      <section className="space-y-3 rounded-md border p-3">
        <h3 className="text-sm font-semibold">3. Sample Information</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label htmlFor="aar-sampleSize">Sample Size</Label>
            <Input id="aar-sampleSize" name="sampleSize" defaultValue={detail?.sampleSize ?? ""} placeholder="e.g. 2 Nos" disabled={locked} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="aar-samplesEvaluated">No. of Samples Evaluated</Label>
            <Input id="aar-samplesEvaluated" name="samplesEvaluated" defaultValue={detail?.samplesEvaluated ?? ""} disabled={locked} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="aar-sampleIds">Sample Identification / Batch No.</Label>
            <Input
              id="aar-sampleIds"
              name="sampleIds"
              defaultValue={detail?.sampleIds ?? sppSampleIds ?? ""}
              placeholder="e.g. NBL-01, NBL-02"
              disabled={locked}
            />
            {!detail?.sampleIds && sppSampleIds ? (
              <p className="text-[11px] text-muted-foreground">From 14. Sample Production Part</p>
            ) : null}
          </div>
        </div>
        <fieldset className="space-y-1" disabled={locked}>
          <legend className="text-sm font-medium">Production Condition</legend>
          <div className="flex flex-wrap gap-x-4 text-sm">
            {PRODUCTION_CONDITIONS.map((c) => (
              <label key={c.value} className="flex items-center gap-1.5">
                <input type="radio" name="productionCondition" value={c.value} defaultChecked={detail?.productionCondition === c.value} />
                {c.label}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      {/* 4. Master sample reference */}
      <section className="space-y-3 rounded-md border p-3">
        <h3 className="text-sm font-semibold">4. Master Sample Reference</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="aar-masterSampleNo">Master Sample No.</Label>
            <Input id="aar-masterSampleNo" name="masterSampleNo" defaultValue={detail?.masterSampleNo ?? ""} disabled={locked} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="aar-masterSampleApprovedBy">Approved by</Label>
            <Input id="aar-masterSampleApprovedBy" name="masterSampleApprovedBy" defaultValue={detail?.masterSampleApprovedBy ?? ""} disabled={locked} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="aar-masterSampleApprovalDate">Approval Date</Label>
            <Input
              id="aar-masterSampleApprovalDate"
              name="masterSampleApprovalDate"
              type="date"
              defaultValue={toDateInputValue(detail?.masterSampleApprovalDate)}
              disabled={locked}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="aar-masterSampleLocation">Retained Location</Label>
            <Input id="aar-masterSampleLocation" name="masterSampleLocation" defaultValue={detail?.masterSampleLocation ?? ""} disabled={locked} />
          </div>
        </div>
      </section>

      {/* 5. Evaluation summary */}
      <section className="space-y-3 rounded-md border p-3">
        <h3 className="text-sm font-semibold">5. Evaluation Summary</h3>
        <fieldset className="space-y-1" disabled={locked}>
          <legend className="text-sm font-medium">Overall Result</legend>
          <div className="flex flex-wrap gap-x-4 text-sm">
            {OVERALL_RESULTS.map((r) => (
              <label key={r.value} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="overallResult"
                  value={r.value}
                  checked={overallResult === r.value}
                  onChange={() => setOverallResult(r.value)}
                />
                {r.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="space-y-1">
          <Label htmlFor="aar-deviationDetails">Deviation Details (if any)</Label>
          <Textarea id="aar-deviationDetails" name="deviationDetails" defaultValue={detail?.deviationDetails ?? ""} disabled={locked} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="aar-correctiveActionPlan">Corrective Action Plan</Label>
          <Textarea id="aar-correctiveActionPlan" name="correctiveActionPlan" defaultValue={detail?.correctiveActionPlan ?? ""} disabled={locked} />
        </div>
      </section>

      {!locked ? (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save AAR"}
          </Button>
          {message ? <span className="text-sm text-muted-foreground">{message}</span> : null}
        </div>
      ) : null}
    </form>
  );
}

function CriteriaRow({
  index,
  row,
  ppapElementId,
  locked,
  labValue,
}: {
  index: number;
  row: Row;
  ppapElementId: string;
  locked: boolean;
  labValue: string | undefined;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setError(null);
    startTransition(async () => {
      try {
        await uploadAarPhoto(row.id, ppapElementId, formData);
        if (fileInputRef.current) fileInputRef.current.value = "";
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      }
    });
  }

  const field = (name: "parameter" | "specification" | "evaluationMethod" | "acceptanceCriteria" | "result", label: string) => (
    <Input
      name={`row-${row.id}-${name}`}
      aria-label={`${row.parameter} ${label}`}
      defaultValue={row[name] ?? ""}
      disabled={locked}
      className="h-8"
    />
  );

  return (
    <tr className="border-b align-top">
      <td className="p-1 pt-2 text-muted-foreground">{index}</td>
      <td className="p-1">{field("parameter", "parameter")}</td>
      <td className="p-1">{field("specification", "specification")}</td>
      <td className="p-1">{field("evaluationMethod", "evaluation method")}</td>
      <td className="p-1">{field("acceptanceCriteria", "acceptance criteria")}</td>
      <td className="p-1">
        {field("result", "result")}
        {row.labPaintProperty ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground">Lab: {labValue ?? "no result yet"}</p>
        ) : null}
      </td>
      <td className="p-1">
        <div className="flex flex-wrap gap-1">
          {row.photos.map((p) => (
            <span key={p.id} className="relative">
              <a href={p.fileUrl} target="_blank" rel="noreferrer" title={p.fileName}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.fileUrl} alt={`${row.parameter} evidence`} className="h-12 w-12 rounded border object-cover" />
              </a>
              {!locked ? (
                <button
                  type="button"
                  aria-label={`Delete photo ${p.fileName}`}
                  className="absolute -right-1 -top-1 rounded-full bg-background px-1 text-xs leading-none text-destructive shadow"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await deleteAarPhoto(p.id, ppapElementId);
                      router.refresh();
                    })
                  }
                >
                  ×
                </button>
              ) : null}
            </span>
          ))}
        </div>
        {!locked ? (
          <div className="mt-1 flex items-center gap-1">
            <input ref={fileInputRef} type="file" accept="image/*" aria-label={`${row.parameter} photo`} className="w-28 text-[11px]" />
            <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={isPending} onClick={handleUpload}>
              Upload
            </Button>
          </div>
        ) : null}
        {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
      </td>
      {!locked ? (
        <td className="p-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={`Delete ${row.parameter}`}
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await deleteAarCriteriaRow(row.id, ppapElementId);
                router.refresh();
              })
            }
          >
            ✕
          </Button>
        </td>
      ) : null}
    </tr>
  );
}
