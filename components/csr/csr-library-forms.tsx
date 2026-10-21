"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCsrSection, deleteCsrSection, saveCsrRequirement, deleteCsrRequirement } from "@/lib/actions/csr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitFormData } from "@/lib/form";

function useRun() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
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
  return { isPending, error, run };
}

type Section = { id: string; code: string; title: string; description: string | null; isZone: boolean; colour: string | null; sortOrder: number };

/** Add / edit a CSR section (e.g. Zone A) for a customer. */
export function CsrSectionForm({ customerId, section, onDone }: { customerId: string; section?: Section; onDone?: () => void }) {
  const { isPending, error, run } = useRun();
  const formRef = useRef<HTMLFormElement>(null);
  const p = section ? `sec-${section.id}` : "sec-new";
  return (
    <form ref={formRef} onSubmit={submitFormData((fd) => run(() => saveCsrSection(section?.id ?? null, customerId, fd), () => { if (!section) formRef.current?.reset(); onDone?.(); }))} className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        <div className="space-y-1">
          <Label htmlFor={`${p}-code`}>Code</Label>
          <Input id={`${p}-code`} name="code" defaultValue={section?.code} required placeholder="A" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`${p}-title`}>Title</Label>
          <Input id={`${p}-title`} name="title" defaultValue={section?.title} required placeholder="Zone A" />
        </div>
        <div className="space-y-1 sm:col-span-3">
          <Label htmlFor={`${p}-description`}>Description</Label>
          <Input id={`${p}-description`} name="description" defaultValue={section?.description ?? ""} placeholder="No defect tolerated" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${p}-colour`}>Colour</Label>
          <Input id={`${p}-colour`} name="colour" type="color" defaultValue={section?.colour ?? "#4472C4"} className="h-9 p-1" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${p}-sortOrder`}>Order</Label>
          <Input id={`${p}-sortOrder`} name="sortOrder" type="number" defaultValue={section?.sortOrder ?? 0} />
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" name="isZone" defaultChecked={section?.isZone ?? true} /> Appearance zone
        </label>
        <div className="space-y-1 sm:col-span-3">
          <Label htmlFor={`${p}-image`}>Illustration</Label>
          <input id={`${p}-image`} name="image" type="file" accept="image/*" className="block w-full text-xs" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {section ? "Save section" : "Add section"}
        </Button>
        {section ? (
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
                if (confirm(`Delete section ${section.code} and its requirements?`)) run(() => deleteCsrSection(section.id));
              }}
            >
              Delete section
            </Button>
          </>
        ) : null}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}

export function CsrSectionEditToggle({ customerId, section }: { customerId: string; section: Section }) {
  const [editing, setEditing] = useState(false);
  return editing ? (
    <div className="rounded-md border p-3">
      <CsrSectionForm customerId={customerId} section={section} onDone={() => setEditing(false)} />
    </div>
  ) : (
    <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
      Edit section
    </Button>
  );
}

type Requirement = { id: string; ruleNo: number; text: string; criteriaKey: string | null };

const CRITERIA = [
  { value: "", label: "—" },
  { value: "GLOSS", label: "Gloss (AAR)" },
  { value: "DFT", label: "DFT (AAR)" },
  { value: "VIEWING_DISTANCE", label: "Viewing distance (AAR)" },
];

/** One requirement row (edit) or the "add requirement" row. */
export function CsrRequirementRow({ sectionId, requirement, nextRuleNo }: { sectionId: string; requirement?: Requirement; nextRuleNo?: number }) {
  const { isPending, error, run } = useRun();
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={formRef}
      onSubmit={submitFormData((fd) => run(() => saveCsrRequirement(requirement?.id ?? null, sectionId, fd), () => { if (!requirement) formRef.current?.reset(); }))}
      className="flex flex-wrap items-start gap-2"
      data-testid={requirement ? "csr-library-requirement" : undefined}
    >
      <Input name="ruleNo" type="number" min={1} aria-label="Rule no." defaultValue={requirement?.ruleNo ?? nextRuleNo} className="h-8 w-16" required />
      <textarea name="text" aria-label="Requirement" defaultValue={requirement?.text} required rows={requirement && requirement.text.length > 90 ? 2 : 1} className="min-w-80 flex-1 rounded-md border bg-transparent px-2 py-1 text-sm" placeholder="New requirement" />
      <select name="criteriaKey" aria-label="Used by AAR as" defaultValue={requirement?.criteriaKey ?? ""} className="h-8 rounded-md border bg-transparent px-2 text-sm">
        {CRITERIA.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant={requirement ? "outline" : "default"} disabled={isPending}>
        {requirement ? "Save" : "Add"}
      </Button>
      {requirement ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label={`Delete rule ${requirement.ruleNo}`}
          disabled={isPending}
          onClick={() => {
            if (confirm(`Delete rule ${requirement.ruleNo}?`)) run(() => deleteCsrRequirement(requirement.id));
          }}
        >
          ✕
        </Button>
      ) : null}
      {error ? <p className="w-full text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
