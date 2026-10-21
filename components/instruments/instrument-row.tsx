"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addCalibrationRecord, deleteCalibrationRecord, deleteInstrument } from "@/lib/actions/instruments";
import { formatDateIndia } from "@/lib/format";
import { submitFormData } from "@/lib/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InstrumentForm, type InstrumentFormValue } from "@/components/instruments/instrument-form";

type CalibrationHistoryEntry = {
  id: string;
  calibratedOn: Date;
  dueDate: Date | null;
  agency: string | null;
  certificateNo: string | null;
  certificateFileUrl: string | null;
  certificateFileName: string | null;
  remarks: string | null;
  recordedByName: string | null;
};

/**
 * Actions + calibration history for one instrument row (the row's cells
 * are server-rendered; this renders the expandable panel under them).
 */
export function InstrumentRowActions({
  instrument,
  history,
  colSpan,
  badge,
}: {
  instrument: InstrumentFormValue;
  history: CalibrationHistoryEntry[];
  colSpan: number;
  badge: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<"none" | "edit" | "history">("none");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function run(action: () => Promise<unknown>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        after?.();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <>
      <tr className="border-b align-top" data-testid={`instrument-${instrument.ieIdNo ?? instrument.slNo}`}>
        <td className="p-1">{instrument.slNo ?? "—"}</td>
        <td className="p-1 font-medium">{instrument.description}</td>
        <td className="p-1">{instrument.range ?? "—"}</td>
        <td className="p-1">{instrument.serialNo ?? "—"}</td>
        <td className="p-1">{instrument.ieIdNo ?? "—"}</td>
        <td className="p-1">{instrument.make ?? "—"}</td>
        <td className="p-1">{instrument.leastCount ?? "—"}</td>
        <td className="p-1">{instrument.calibrationFrequencyMonths != null ? `${instrument.calibrationFrequencyMonths} mo` : "—"}</td>
        <td className="p-1">{formatDateIndia(instrument.calibratedOn)}</td>
        <td className="p-1">
          {formatDateIndia(instrument.calibrationDue)}
          {instrument.calibrationDueOverridden ? <span className="block text-[10px] text-muted-foreground">set manually</span> : null}
        </td>
        <td className="p-1">{instrument.location ?? "—"}</td>
        <td className="p-1">{badge}</td>
        <td className="p-1">{instrument.remarks ?? ""}</td>
        <td className="p-1">
          <div className="flex gap-1">
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(open === "edit" ? "none" : "edit")}>
              Edit
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(open === "history" ? "none" : "history")}>
              History ({history.length})
            </Button>
          </div>
        </td>
      </tr>
      {open !== "none" || error ? (
        <tr className="border-b bg-muted/30">
          <td colSpan={colSpan} className="p-3">
            {open === "edit" ? (
              <div className="space-y-2">
                <InstrumentForm instrument={instrument} onDone={() => setOpen("none")} />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={isPending}
                  onClick={() => {
                    if (confirm(`Delete "${instrument.description}"?`)) run(() => deleteInstrument(instrument.id));
                  }}
                >
                  Delete instrument
                </Button>
              </div>
            ) : null}
            {open === "history" ? (
              <div className="space-y-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="p-1">Calibrated on</th>
                      <th className="p-1">Due</th>
                      <th className="p-1">Agency</th>
                      <th className="p-1">Certificate</th>
                      <th className="p-1">Remarks</th>
                      <th className="p-1">Recorded by</th>
                      <th className="p-1" />
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id}>
                        <td className="p-1">{formatDateIndia(h.calibratedOn)}</td>
                        <td className="p-1">{formatDateIndia(h.dueDate)}</td>
                        <td className="p-1">{h.agency ?? "—"}</td>
                        <td className="p-1">
                          {h.certificateNo ?? ""}{" "}
                          {h.certificateFileUrl ? (
                            <a href={h.certificateFileUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                              {h.certificateFileName ?? "certificate"}
                            </a>
                          ) : null}
                        </td>
                        <td className="p-1">{h.remarks ?? ""}</td>
                        <td className="p-1">{h.recordedByName ?? "—"}</td>
                        <td className="p-1">
                          <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={() => run(() => deleteCalibrationRecord(h.id))}>
                            ✕
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {history.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-1 text-muted-foreground">
                          No calibration records yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
                <form
                  ref={formRef}
                  onSubmit={submitFormData((formData) => run(() => addCalibrationRecord(instrument.id, formData), () => formRef.current?.reset()))}
                  className="grid grid-cols-2 items-end gap-2 sm:grid-cols-6"
                >
                  <div className="space-y-1">
                    <Label htmlFor={`cal-${instrument.id}-on`}>Calibrated on</Label>
                    <Input id={`cal-${instrument.id}-on`} name="calibratedOn" type="date" required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`cal-${instrument.id}-due`}>Due (if on certificate)</Label>
                    <Input id={`cal-${instrument.id}-due`} name="dueDate" type="date" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`cal-${instrument.id}-agency`}>Agency</Label>
                    <Input id={`cal-${instrument.id}-agency`} name="agency" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`cal-${instrument.id}-certno`}>Certificate No.</Label>
                    <Input id={`cal-${instrument.id}-certno`} name="certificateNo" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`cal-${instrument.id}-file`}>Certificate file</Label>
                    <input id={`cal-${instrument.id}-file`} name="certificate" type="file" accept="application/pdf,image/*" className="block w-full text-xs" />
                  </div>
                  <Button type="submit" size="sm" disabled={isPending}>
                    Record calibration
                  </Button>
                </form>
              </div>
            ) : null}
            {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
          </td>
        </tr>
      ) : null}
    </>
  );
}
