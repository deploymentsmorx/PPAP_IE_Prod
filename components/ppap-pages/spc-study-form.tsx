"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSpcStudy, updateSpcStudy } from "@/lib/actions/spc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Prisma } from "@/app/generated/prisma/client";

type Study = Prisma.SpcStudyGetPayload<object>;
type Instrument = { id: string; description: string; pickable: boolean };
type CharacteristicOption = { id: string; characteristic: string; charClass: string };

function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export function SpcStudyForm({
  ppapElementId,
  study,
  characteristics,
  instruments,
  onDone,
}: {
  ppapElementId: string;
  study: Study | null;
  characteristics: CharacteristicOption[];
  instruments: Instrument[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      if (study) {
        await updateSpcStudy(study.id, ppapElementId, formData);
      } else {
        await createSpcStudy(ppapElementId, formData);
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-3 rounded-md border p-3">
      {characteristics.length === 0 ? (
        <p className="rounded bg-muted px-3 py-2 text-xs text-muted-foreground">
          No special characteristics defined yet — add one on the Design Record page (element 1) before creating a study.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="specialCharacteristicId">Characteristic (Control Plan)</Label>
          <select
            id="specialCharacteristicId"
            name="specialCharacteristicId"
            defaultValue={study?.specialCharacteristicId ?? ""}
            required
            className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="" disabled>
              — Select —
            </option>
            {characteristics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.characteristic} ({c.charClass})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="studyDate">Date</Label>
          <Input id="studyDate" name="studyDate" type="date" defaultValue={toDateInputValue(study?.studyDate)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dcNo">DC No.</Label>
          <Input id="dcNo" name="dcNo" defaultValue={study?.dcNo ?? ""} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="usl">USL</Label>
          <Input id="usl" name="usl" type="number" step="any" defaultValue={study?.usl ?? ""} placeholder="auto from Control Plan" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="lsl">LSL</Label>
          <Input id="lsl" name="lsl" type="number" step="any" defaultValue={study?.lsl ?? ""} placeholder="auto from Control Plan" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="specText">Spec (display)</Label>
          <Input id="specText" name="specText" defaultValue={study?.specText ?? ""} placeholder="auto from Control Plan" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="instrumentId">Instrument</Label>
          <select
            id="instrumentId"
            name="instrumentId"
            defaultValue={study?.instrumentId ?? ""}
            className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="">auto from Control Plan</option>
            {instruments.map((i) => (
              <option key={i.id} value={i.id} disabled={!i.pickable}>
                {i.description}
                {!i.pickable ? " (overdue)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="leastCountText">Least Count</Label>
          <Input id="leastCountText" name="leastCountText" defaultValue={study?.leastCountText ?? ""} placeholder="auto from Control Plan" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="machine">Machine</Label>
          <Input id="machine" name="machine" defaultValue={study?.machine ?? ""} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="operation">Operation</Label>
          <Input id="operation" name="operation" defaultValue={study?.operation ?? ""} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        <div className="space-y-1">
          <Label htmlFor="qty">Qty</Label>
          <Input id="qty" name="qty" type="number" min={0} defaultValue={study?.qty ?? ""} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="decimals">Decimals</Label>
          <Input id="decimals" name="decimals" type="number" min={0} max={6} defaultValue={study?.decimals ?? 3} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="subgroupSize">Subgroup Size</Label>
          <Input id="subgroupSize" name="subgroupSize" type="number" min={2} max={15} defaultValue={study?.subgroupSize ?? 5} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="subgroupCount">Subgroup Count</Label>
          <Input id="subgroupCount" name="subgroupCount" type="number" min={1} defaultValue={study?.subgroupCount ?? 5} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cpkAcceptableMin">Cpk Acceptable ≥</Label>
          <Input id="cpkAcceptableMin" name="cpkAcceptableMin" type="number" step="any" defaultValue={study?.cpkAcceptableMin ?? 1.67} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cpkConditionalMin">Cpk Conditional ≥</Label>
          <Input id="cpkConditionalMin" name="cpkConditionalMin" type="number" step="any" defaultValue={study?.cpkConditionalMin ?? 1.33} />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending || characteristics.length === 0}>
          {isPending ? "Saving..." : study ? "Save Study" : "Create Study"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
