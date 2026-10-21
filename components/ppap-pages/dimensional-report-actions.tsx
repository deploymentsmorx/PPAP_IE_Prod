"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importDimensionalReportExcel, generateRowsFromBalloons, addSampleColumn, deleteSampleColumn } from "@/lib/actions/dimensional-report";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SampleColumn = { id: string; label: string };

export function DimensionalReportActions({
  ppapElementId,
  locked,
  sampleColumns,
}: {
  ppapElementId: string;
  locked: boolean;
  sampleColumns: SampleColumn[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newColumnLabel, setNewColumnLabel] = useState("");

  function handleImport() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    startTransition(async () => {
      try {
        const result = await importDimensionalReportExcel(ppapElementId, formData);
        setMessage(`Imported ${result.imported} rows.`);
        if (fileInputRef.current) fileInputRef.current.value = "";
        router.refresh();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Import failed.");
      }
    });
  }

  function handleGenerateFromBalloons() {
    startTransition(async () => {
      const result = await generateRowsFromBalloons(ppapElementId);
      setMessage(`Generated from balloons: ${result.added} row(s) added.`);
      router.refresh();
    });
  }

  function handleAddColumn() {
    if (!newColumnLabel.trim()) return;
    startTransition(async () => {
      await addSampleColumn(ppapElementId, newColumnLabel.trim());
      setNewColumnLabel("");
      router.refresh();
    });
  }

  function handleDeleteColumn(columnId: string) {
    startTransition(async () => {
      await deleteSampleColumn(columnId, ppapElementId);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border p-3">
      {!locked ? (
        <>
          <Button type="button" size="sm" variant="outline" onClick={handleGenerateFromBalloons} disabled={isPending}>
            Generate from Balloons
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx" className="text-xs" />
          <Button type="button" size="sm" disabled={isPending} onClick={handleImport}>
            {isPending ? "Importing..." : "Import Excel"}
          </Button>
          <span className="mx-2 h-5 w-px bg-border" />
          <span className="text-xs text-muted-foreground">Sample columns:</span>
          {sampleColumns.map((c) => (
            <span key={c.id} className="flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs">
              {c.label}
              <button type="button" onClick={() => handleDeleteColumn(c.id)} className="text-muted-foreground hover:text-destructive" aria-label={`Remove ${c.label}`}>
                ×
              </button>
            </span>
          ))}
          <Input
            value={newColumnLabel}
            onChange={(e) => setNewColumnLabel(e.target.value)}
            placeholder="Sample 3"
            className="h-7 w-24 text-xs"
          />
          <Button type="button" size="sm" variant="ghost" onClick={handleAddColumn} disabled={!newColumnLabel.trim() || isPending}>
            + Add column
          </Button>
        </>
      ) : null}
      {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
    </div>
  );
}
