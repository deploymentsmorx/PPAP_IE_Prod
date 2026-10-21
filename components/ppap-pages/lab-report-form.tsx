"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLabReport, updateLabReport } from "@/lib/actions/lab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Prisma } from "@/app/generated/prisma/client";

type Report = Prisma.LabReportGetPayload<object>;
type LabOption = { id: string; name: string; pickable: boolean };
type MaterialSpecOption = { id: string; standard: string; grade: string };
type HeatOption = { id: string; heatNo: string; partNo: string | null };

function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export function LabReportForm({
  ppapElementId,
  report,
  labs,
  materialSpecs,
  heatOptions,
  onDone,
}: {
  ppapElementId: string;
  report: Report | null;
  labs: LabOption[];
  materialSpecs: MaterialSpecOption[];
  heatOptions: HeatOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        if (report) {
          await updateLabReport(report.id, ppapElementId, formData);
        } else {
          await createLabReport(ppapElementId, formData);
        }
        router.refresh();
        onDone();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Could not save report.");
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-3 rounded-md border p-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="companyName">Company</Label>
          <Input id="companyName" name="companyName" defaultValue={report?.companyName ?? ""} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="labId">Lab</Label>
          <select id="labId" name="labId" defaultValue={report?.labId ?? ""} className="h-9 w-full rounded-md border bg-transparent px-2 text-sm">
            <option value="">— None —</option>
            {labs.map((l) => (
              <option key={l.id} value={l.id} disabled={!l.pickable}>
                {l.name}
                {!l.pickable ? " (expired)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="reportNo">Report No.</Label>
          <Input id="reportNo" name="reportNo" defaultValue={report?.reportNo ?? ""} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="testDate">Test Date</Label>
          <Input id="testDate" name="testDate" type="date" defaultValue={toDateInputValue(report?.testDate)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="materialSpecId">Material Grade</Label>
          <select
            id="materialSpecId"
            name="materialSpecId"
            defaultValue={report?.materialSpecId ?? ""}
            className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="">— None —</option>
            {materialSpecs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.standard} {s.grade}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="materialGradeText">Material Grade (display)</Label>
          <Input id="materialGradeText" name="materialGradeText" defaultValue={report?.materialGradeText ?? ""} placeholder="auto from grade above" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rmtcReportRowId">Heat/Batch No</Label>
          <select
            id="rmtcReportRowId"
            name="rmtcReportRowId"
            defaultValue={report?.rmtcReportRowId ?? ""}
            className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="">— None —</option>
            {heatOptions.map((h) => (
              <option key={h.id} value={h.id}>
                {h.heatNo} {h.partNo ? `(${h.partNo})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="heatBatchNoText">Heat/Batch No (override)</Label>
          <Input id="heatBatchNoText" name="heatBatchNoText" defaultValue={report?.heatBatchNoText ?? ""} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="sampleQty">Sample Qty</Label>
          <Input id="sampleQty" name="sampleQty" type="number" min={0} defaultValue={report?.sampleQty ?? ""} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="manufacturingProcess">Manufacturing Process</Label>
          <Input id="manufacturingProcess" name="manufacturingProcess" defaultValue={report?.manufacturingProcess ?? ""} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="heatTreatmentStatus">Heat Treatment Status</Label>
          <Input id="heatTreatmentStatus" name="heatTreatmentStatus" defaultValue={report?.heatTreatmentStatus ?? ""} />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : report ? "Save Report" : "Create Report"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
