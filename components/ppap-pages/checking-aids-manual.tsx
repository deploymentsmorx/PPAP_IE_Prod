"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPpapCheckingAid, removePpapCheckingAid } from "@/lib/actions/instruments";
import { Button } from "@/components/ui/button";

type Option = { id: string; label: string; pickable?: boolean };

/** Manually add an instrument or fixture to this part's element 16 list. */
export function CheckingAidsAdd({ ppapElementId, instruments, fixtures }: { ppapElementId: string; instruments: Option[]; fixtures: Option[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    if (!value) return;
    const [kind, id] = value.split(":");
    setError(null);
    startTransition(async () => {
      try {
        await addPpapCheckingAid(ppapElementId, kind === "i" ? { instrumentId: id } : { fixtureId: id });
        setValue("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Add instrument or fixture"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-9 min-w-80 rounded-md border bg-transparent px-2 text-sm"
      >
        <option value="">— Add an instrument or fixture —</option>
        <optgroup label="Instruments">
          {instruments.map((i) => (
            <option key={i.id} value={`i:${i.id}`}>
              {i.label}
              {i.pickable === false ? " (overdue / not calibrated)" : ""}
            </option>
          ))}
        </optgroup>
        <optgroup label="Fixtures / gauges">
          {fixtures.map((f) => (
            <option key={f.id} value={`f:${f.id}`}>
              {f.label}
            </option>
          ))}
        </optgroup>
      </select>
      <Button type="button" size="sm" variant="outline" disabled={!value || isPending} onClick={handleAdd}>
        Add
      </Button>
      {error ? <span className="text-sm text-destructive">{error}</span> : null}
    </div>
  );
}

export function CheckingAidRemove({ ppapElementId, instrumentId, fixtureId, label }: { ppapElementId: string; instrumentId?: string; fixtureId?: string; label: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      aria-label={`Remove ${label}`}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await removePpapCheckingAid(ppapElementId, instrumentId ? { instrumentId } : { fixtureId });
          router.refresh();
        })
      }
    >
      ✕
    </Button>
  );
}
