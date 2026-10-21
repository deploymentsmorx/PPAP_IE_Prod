"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setElementNaToggle } from "@/lib/actions/na-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NaToggle({
  ppapElementId,
  label,
  defaultReason,
  initialEnabled,
  initialReason,
  locked,
}: {
  ppapElementId: string;
  label: string;
  defaultReason: string;
  initialEnabled: boolean;
  initialReason: string;
  locked: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [reason, setReason] = useState(initialReason);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function save(nextEnabled: boolean) {
    startTransition(async () => {
      await setElementNaToggle(ppapElementId, nextEnabled, reason, defaultReason);
      // Dependent sections' visibility is computed by the parent Server
      // Component from applicability — refresh so it updates immediately
      // instead of only after the next full navigation.
      router.refresh();
    });
  }

  return (
    <div className="mb-4 space-y-2 rounded-md border p-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={enabled}
          disabled={locked}
          onChange={(e) => {
            setEnabled(e.target.checked);
            save(e.target.checked);
          }}
        />
        {label}
      </label>
      {enabled ? (
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor={`na-reason-${ppapElementId}`} className="text-xs text-muted-foreground">
              Reason
            </Label>
            <Input
              id={`na-reason-${ppapElementId}`}
              value={reason}
              disabled={locked}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <Button type="button" size="sm" disabled={locked || isPending} onClick={() => save(true)}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
