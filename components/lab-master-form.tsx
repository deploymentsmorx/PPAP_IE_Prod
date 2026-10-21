"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLabMaster, updateLabMaster } from "@/lib/actions/lab-master";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitFormData } from "@/lib/form";

const ACCREDITATION_BODIES = ["ISO/IEC 17025", "NABL"];

export type LabMasterFormLab = {
  id: string;
  name: string;
  accreditationBody: string | null;
  certificateNo: string | null;
  scope: string | null;
  validUntil: Date | null;
  certificatePdfUrl: string | null;
  certificatePdfName: string | null;
};

function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

/** Add a lab (no `lab`) or edit one (`lab` given, `onDone` closes the editor). */
export function LabMasterForm({ lab, onDone }: { lab?: LabMasterFormLab; onDone?: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const idPrefix = lab ? `lab-${lab.id}` : "lab-new";

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        if (lab) {
          await updateLabMaster(lab.id, formData);
        } else {
          await createLabMaster(formData);
          formRef.current?.reset();
        }
        router.refresh();
        onDone?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save lab.");
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={submitFormData(handleSubmit)} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1">
          <Label htmlFor={`${idPrefix}-name`}>Lab name</Label>
          <Input id={`${idPrefix}-name`} name="name" defaultValue={lab?.name} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-accreditation`}>Accreditation</Label>
          <Input
            id={`${idPrefix}-accreditation`}
            name="accreditationBody"
            list={`${idPrefix}-accreditation-options`}
            defaultValue={lab?.accreditationBody ?? ""}
            placeholder="ISO/IEC 17025 / NABL"
          />
          <datalist id={`${idPrefix}-accreditation-options`}>
            {ACCREDITATION_BODIES.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-certificate-no`}>Certificate no.</Label>
          <Input id={`${idPrefix}-certificate-no`} name="certificateNo" defaultValue={lab?.certificateNo ?? ""} />
        </div>
        <div className="col-span-2 space-y-1">
          <Label htmlFor={`${idPrefix}-scope`}>Scope</Label>
          <Input id={`${idPrefix}-scope`} name="scope" defaultValue={lab?.scope ?? ""} placeholder="e.g. Chemical & mechanical testing of ferrous metals" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-valid-until`}>Valid until</Label>
          <Input id={`${idPrefix}-valid-until`} name="validUntil" type="date" defaultValue={toDateInputValue(lab?.validUntil)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-certificate-pdf`}>Certificate PDF</Label>
          <input id={`${idPrefix}-certificate-pdf`} name="certificatePdf" type="file" accept="application/pdf" className="block w-full text-xs" />
          {lab?.certificatePdfUrl ? (
            <p className="text-xs text-muted-foreground">
              Current:{" "}
              <a href={lab.certificatePdfUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                {lab.certificatePdfName ?? "certificate.pdf"}
              </a>{" "}
              (choose a file to replace)
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving..." : lab ? "Save Lab" : "Add Lab"}
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
