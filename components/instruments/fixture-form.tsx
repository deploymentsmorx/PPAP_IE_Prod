"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveFixture, deleteFixture } from "@/lib/actions/instruments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { FIXTURE_TYPE_LABEL, FIXTURE_STATUS_LABEL } from "@/lib/constants/fixtures";
import { submitFormData } from "@/lib/form";

export type FixtureFormValue = {
  id: string;
  code: string;
  description: string;
  type: keyof typeof FIXTURE_TYPE_LABEL;
  partId: string | null;
  drawingNo: string | null;
  drawingFileName: string | null;
  validationDate: Date | null;
  validationRecordName: string | null;
  status: keyof typeof FIXTURE_STATUS_LABEL;
  location: string | null;
  remarks: string | null;
};

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const selectClass = "h-9 w-full rounded-md border bg-transparent px-2 text-sm";

/** Add or edit a checking fixture / template / jig / gauge. */
export function FixtureForm({ fixture, parts, onDone }: { fixture?: FixtureFormValue; parts: { id: string; label: string }[]; onDone?: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const p = fixture ? `fx-${fixture.id}` : "fx-new";

  function run(action: () => Promise<unknown>, reset = false) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        if (reset) formRef.current?.reset();
        router.refresh();
        onDone?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save fixture.");
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={submitFormData((fd) => run(() => saveFixture(fixture?.id ?? null, fd), !fixture))} className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor={`${p}-code`}>Code</Label>
          <Input id={`${p}-code`} name="code" defaultValue={fixture?.code} required placeholder="e.g. CF-NBL-01" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${p}-description`}>Description</Label>
          <Input id={`${p}-description`} name="description" defaultValue={fixture?.description} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${p}-type`}>Type</Label>
          <select id={`${p}-type`} name="type" defaultValue={fixture?.type ?? "CHECKING_FIXTURE"} className={selectClass}>
            {Object.entries(FIXTURE_TYPE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${p}-partId`}>Part</Label>
          <select id={`${p}-partId`} name="partId" defaultValue={fixture?.partId ?? ""} className={selectClass}>
            <option value="">— Any / not part-specific —</option>
            {parts.map((part) => (
              <option key={part.id} value={part.id}>
                {part.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${p}-drawingNo`}>Drawing No.</Label>
          <Input id={`${p}-drawingNo`} name="drawingNo" defaultValue={fixture?.drawingNo ?? ""} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${p}-drawingFile`}>Drawing file</Label>
          <input id={`${p}-drawingFile`} name="drawingFile" type="file" className="block w-full text-xs" />
          {fixture?.drawingFileName ? <p className="text-[11px] text-muted-foreground">Current: {fixture.drawingFileName}</p> : null}
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${p}-validationDate`}>Validated on</Label>
          <Input id={`${p}-validationDate`} name="validationDate" type="date" defaultValue={iso(fixture?.validationDate)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${p}-validationRecord`}>Validation record</Label>
          <input id={`${p}-validationRecord`} name="validationRecord" type="file" className="block w-full text-xs" />
          {fixture?.validationRecordName ? <p className="text-[11px] text-muted-foreground">Current: {fixture.validationRecordName}</p> : null}
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${p}-status`}>Status</Label>
          <select id={`${p}-status`} name="status" defaultValue={fixture?.status ?? "ACTIVE"} className={selectClass}>
            {Object.entries(FIXTURE_STATUS_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${p}-location`}>Location</Label>
          <Input id={`${p}-location`} name="location" defaultValue={fixture?.location ?? ""} />
        </div>
        <div className="col-span-2 space-y-1">
          <Label htmlFor={`${p}-remarks`}>Remarks</Label>
          <Input id={`${p}-remarks`} name="remarks" defaultValue={fixture?.remarks ?? ""} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving..." : fixture ? "Save fixture" : "Add fixture"}
        </Button>
        {fixture ? (
          <>
            <Button type="button" size="sm" variant="ghost" onClick={onDone}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive"
              disabled={isPending}
              onClick={() => {
                if (confirm(`Delete fixture "${fixture.code}"?`)) run(() => deleteFixture(fixture.id));
              }}
            >
              Delete
            </Button>
          </>
        ) : null}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}

/** Edit toggle for a fixture register row. */
export function FixtureEditToggle({ fixture, parts }: { fixture: FixtureFormValue; parts: { id: string; label: string }[] }) {
  const [editing, setEditing] = useState(false);
  return editing ? (
    <div className="min-w-[40rem] rounded-md border p-3">
      <FixtureForm fixture={fixture} parts={parts} onDone={() => setEditing(false)} />
    </div>
  ) : (
    <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
      Edit
    </Button>
  );
}
