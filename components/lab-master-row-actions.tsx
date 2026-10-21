"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteLabMaster } from "@/lib/actions/lab-master";
import { Button } from "@/components/ui/button";
import { LabMasterForm, type LabMasterFormLab } from "@/components/lab-master-form";

export function LabMasterRowActions({ lab }: { lab: LabMasterFormLab }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!confirm(`Delete "${lab.name}"?`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteLabMaster(lab.id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not delete lab.");
      }
    });
  }

  if (editing) {
    return (
      <div className="min-w-[28rem] rounded-md border p-3">
        <LabMasterForm lab={lab} onDone={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
          Edit
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={handleDelete} disabled={isPending}>
          Delete
        </Button>
      </div>
      {error ? <p className="max-w-56 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
