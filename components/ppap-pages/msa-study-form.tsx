"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createStudy, updateStudy } from "@/lib/actions/msa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Prisma } from "@/app/generated/prisma/client";

type Study = Prisma.MsaStudyGetPayload<object>;
type Instrument = { id: string; description: string; pickable: boolean };
type ControlPlanRowOption = { id: string; productCharacteristic: string | null; processCharacteristic: string | null };

function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export function MsaStudyForm({
  ppapElementId,
  study,
  instruments,
  controlPlanRows,
  onDone,
}: {
  ppapElementId: string;
  study: Study | null;
  instruments: Instrument[];
  controlPlanRows: ControlPlanRowOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      if (study) {
        await updateStudy(study.id, ppapElementId, formData);
      } else {
        await createStudy(ppapElementId, formData);
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-3 rounded-md border p-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="studyType">Study Type</Label>
          <select
            id="studyType"
            name="studyType"
            defaultValue={study?.studyType ?? "VARIABLE_GRR"}
            className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="VARIABLE_GRR">Variable GR&amp;R</option>
            <option value="ATTRIBUTE_AGREEMENT">Attribute Agreement</option>
            <option value="BIAS">Bias</option>
            <option value="LINEARITY">Linearity</option>
            <option value="STABILITY">Stability</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="method">Method</Label>
          <select
            id="method"
            name="method"
            defaultValue={study?.method ?? "AVERAGE_RANGE"}
            className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="AVERAGE_RANGE">Average &amp; Range</option>
            <option value="ANOVA">ANOVA</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="studyDate">Date</Label>
          <Input id="studyDate" name="studyDate" type="date" defaultValue={toDateInputValue(study?.studyDate)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="units">Units</Label>
          <Input id="units" name="units" defaultValue={study?.units ?? "mm"} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="gaugeId">Gauge (Instrument)</Label>
          <select
            id="gaugeId"
            name="gaugeId"
            defaultValue={study?.gaugeId ?? ""}
            className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="">— None —</option>
            {instruments.map((i) => (
              <option key={i.id} value={i.id} disabled={!i.pickable}>
                {i.description}
                {!i.pickable ? " (overdue)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="gaugeType">Gauge Type</Label>
          <Input id="gaugeType" name="gaugeType" defaultValue={study?.gaugeType ?? ""} placeholder="e.g. Vernier Caliper" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="controlPlanRowId">Characteristic (Control Plan)</Label>
          <select
            id="controlPlanRowId"
            name="controlPlanRowId"
            defaultValue={study?.controlPlanRowId ?? ""}
            className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="">— None —</option>
            {controlPlanRows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.productCharacteristic || r.processCharacteristic || "(unnamed)"}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="characteristicText">Characteristic (override)</Label>
          <Input id="characteristicText" name="characteristicText" defaultValue={study?.characteristicText ?? ""} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="specification">Specification</Label>
          <Input id="specification" name="specification" defaultValue={study?.specification ?? ""} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="testNo">Test No.</Label>
          <Input id="testNo" name="testNo" defaultValue={study?.testNo ?? ""} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="usl">USL</Label>
          <Input id="usl" name="usl" type="number" step="any" defaultValue={study?.usl ?? ""} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="lsl">LSL</Label>
          <Input id="lsl" name="lsl" type="number" step="any" defaultValue={study?.lsl ?? ""} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label htmlFor="appraiserAName">Appraiser A</Label>
          <Input id="appraiserAName" name="appraiserAName" defaultValue={study?.appraiserAName ?? ""} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="appraiserBName">Appraiser B</Label>
          <Input id="appraiserBName" name="appraiserBName" defaultValue={study?.appraiserBName ?? ""} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="appraiserCName">Appraiser C</Label>
          <Input id="appraiserCName" name="appraiserCName" defaultValue={study?.appraiserCName ?? ""} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:w-1/2">
        <div className="space-y-1">
          <Label htmlFor="parts">Parts (p)</Label>
          <Input id="parts" name="parts" type="number" min={2} defaultValue={study?.parts ?? 10} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="appraisers">Appraisers (o)</Label>
          <select
            id="appraisers"
            name="appraisers"
            defaultValue={study?.appraisers ?? 3}
            className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
          >
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="trials">Trials (n)</Label>
          <select
            id="trials"
            name="trials"
            defaultValue={study?.trials ?? 3}
            className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
          >
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="notes">Notes (used for Attribute Agreement / Bias / Linearity / Stability studies)</Label>
        <Textarea id="notes" name="notes" defaultValue={study?.notes ?? ""} className="h-16" />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : study ? "Save Study" : "Create Study"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
