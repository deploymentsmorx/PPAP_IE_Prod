"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importPfmeaExcel } from "@/lib/actions/pfmea";
import { Button } from "@/components/ui/button";

export function PfmeaExcelActions({ ppapElementId, locked }: { ppapElementId: string; locked: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  function handleImport() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    startTransition(async () => {
      try {
        const result = await importPfmeaExcel(ppapElementId, formData);
        setMessage(`Imported ${result.imported} rows. ${result.apMismatches} row(s) have a typed Action Priority that disagrees with the computed value.`);
        if (fileInputRef.current) fileInputRef.current.value = "";
        router.refresh();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Import failed.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border p-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        render={<a href={`/api/pfmea/${ppapElementId}/export`} />}
        nativeButton={false}
      >
        Export Excel
      </Button>
      {!locked ? (
        <>
          <input ref={fileInputRef} type="file" accept=".xlsx" className="text-xs" />
          <Button type="button" size="sm" disabled={isPending} onClick={handleImport}>
            {isPending ? "Importing..." : "Import Excel"}
          </Button>
        </>
      ) : null}
      {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
    </div>
  );
}
