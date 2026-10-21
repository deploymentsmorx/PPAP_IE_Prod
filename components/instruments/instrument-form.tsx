"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveInstrument } from "@/lib/actions/instruments";
import { computeCalibrationDue } from "@/lib/calc/calibration";
import { formatDateIndia } from "@/lib/format";
import { submitFormData } from "@/lib/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type InstrumentFormValue = {
  id: string;
  slNo: number | null;
  description: string;
  range: string | null;
  serialNo: string | null;
  ieIdNo: string | null;
  make: string | null;
  leastCount: string | null;
  calibrationFrequencyMonths: number | null;
  calibratedOn: Date | null;
  calibrationDue: Date | null;
  calibrationDueOverridden: boolean;
  location: string | null;
  remarks: string | null;
};

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");

/** Add (no `instrument`) or edit an instrument master row. */
export function InstrumentForm({ instrument, onDone }: { instrument?: InstrumentFormValue; onDone?: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [calibratedOn, setCalibratedOn] = useState(iso(instrument?.calibratedOn));
  const [months, setMonths] = useState(instrument?.calibrationFrequencyMonths?.toString() ?? "12");
  const p = instrument ? `inst-${instrument.id}` : "inst-new";

  const computed = computeCalibrationDue(calibratedOn ? new Date(`${calibratedOn}T00:00:00.000Z`) : null, months === "" ? null : Number(months));

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await saveInstrument(instrument?.id ?? null, formData);
        if (!instrument) formRef.current?.reset();
        router.refresh();
        onDone?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save instrument.");
      }
    });
  }

  const field = (name: keyof InstrumentFormValue, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1">
      <Label htmlFor={`${p}-${name}`}>{label}</Label>
      <Input id={`${p}-${name}`} name={name} defaultValue={(instrument?.[name] as string | number | null | undefined) ?? ""} {...props} />
    </div>
  );

  return (
    <form ref={formRef} onSubmit={submitFormData(handleSubmit)} className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {field("description", "Description", { required: true })}
        {field("ieIdNo", "IE ID No.")}
        {field("range", "Range")}
        {field("serialNo", "Serial No.")}
        {field("make", "Make")}
        {field("leastCount", "Least count")}
        {field("location", "Location")}
        {field("slNo", "Sl. No.", { type: "number", min: 1 })}
        <div className="space-y-1">
          <Label htmlFor={`${p}-calibrationFrequencyMonths`}>Calibration frequency (months)</Label>
          <Input
            id={`${p}-calibrationFrequencyMonths`}
            name="calibrationFrequencyMonths"
            type="number"
            min={0}
            value={months}
            onChange={(e) => setMonths(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${p}-calibratedOn`}>Calibrated on</Label>
          <Input id={`${p}-calibratedOn`} name="calibratedOn" type="date" value={calibratedOn} onChange={(e) => setCalibratedOn(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${p}-dueOverride`}>Calibration due (override)</Label>
          <Input
            id={`${p}-dueOverride`}
            name="dueOverride"
            type="date"
            defaultValue={instrument?.calibrationDueOverridden ? iso(instrument.calibrationDue) : ""}
          />
          <p className="text-[11px] text-muted-foreground">Computed: {computed ? formatDateIndia(computed) : "—"} — leave blank to use it.</p>
        </div>
        {field("remarks", "Remarks")}
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving..." : instrument ? "Save instrument" : "Add instrument"}
        </Button>
        {onDone ? (
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
