"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSpcData, type SpcReadingInput } from "@/lib/actions/spc";
import { Button } from "@/components/ui/button";

type Reading = { subgroupIndex: number; withinIndex: number; value: number | null };

function buildMatrix(subgroupCount: number, subgroupSize: number, readings: Reading[]): string[][] {
  const matrix: string[][] = Array.from({ length: subgroupCount }, () => Array.from({ length: subgroupSize }, () => ""));
  for (const r of readings) {
    if (r.subgroupIndex < subgroupCount && r.withinIndex < subgroupSize && r.value !== null) {
      matrix[r.subgroupIndex][r.withinIndex] = String(r.value);
    }
  }
  return matrix;
}

export function SpcDataGrid({
  studyId,
  ppapElementId,
  locked,
  subgroupCount,
  subgroupSize,
  decimals,
  readings,
}: {
  studyId: string;
  ppapElementId: string;
  locked: boolean;
  subgroupCount: number;
  subgroupSize: number;
  decimals: number;
  readings: Reading[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [matrix, setMatrix] = useState<string[][]>(() => buildMatrix(subgroupCount, subgroupSize, readings));
  const [message, setMessage] = useState<string | null>(null);

  const withinLabels = useMemo(() => Array.from({ length: subgroupSize }, (_, i) => `${i + 1}`), [subgroupSize]);

  function setCell(subgroupIndex: number, withinIndex: number, value: string) {
    setMatrix((prev) => {
      const next = prev.map((row) => [...row]);
      next[subgroupIndex][withinIndex] = value;
      return next;
    });
  }

  function handlePaste(subgroupIndex: number, withinIndex: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\t") && !text.includes("\n") && !text.includes(",")) return; // let a single value paste normally
    e.preventDefault();
    const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.length > 0);
    setMatrix((prev) => {
      const next = prev.map((row) => [...row]);
      lines.forEach((line, i) => {
        const cells = line.includes("\t") ? line.split("\t") : line.split(",");
        cells.forEach((cell, j) => {
          const r = subgroupIndex + i;
          const c = withinIndex + j;
          if (r < subgroupCount && c < subgroupSize) next[r][c] = cell.trim();
        });
      });
      return next;
    });
  }

  function handleSave() {
    const points: SpcReadingInput[] = [];
    for (let s = 0; s < subgroupCount; s++) {
      for (let w = 0; w < subgroupSize; w++) {
        const raw = matrix[s][w];
        const value = raw.trim() === "" ? null : Number(raw);
        points.push({ subgroupIndex: s, withinIndex: w, value: value !== null && Number.isFinite(value) ? value : null });
      }
    }
    startTransition(async () => {
      await saveSpcData(studyId, ppapElementId, points);
      setMessage("Data saved.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/50">
              <th className="border-b p-1.5 text-left font-semibold">Subgroup</th>
              {withinLabels.map((label) => (
                <th key={label} className="border-b p-1.5 text-left font-semibold whitespace-nowrap">
                  Reading {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: subgroupCount }, (_, s) => (
              <tr key={s} className="border-b">
                <td className="p-1.5 font-medium">{s + 1}</td>
                {Array.from({ length: subgroupSize }, (_, w) => (
                  <td key={w} className="p-1">
                    <input
                      aria-label={`Subgroup ${s + 1} reading ${w + 1}`}
                      value={matrix[s][w]}
                      disabled={locked}
                      onChange={(e) => setCell(s, w, e.target.value)}
                      onPaste={(e) => handlePaste(s, w, e)}
                      className="h-7 w-20 rounded-md border bg-transparent px-1 text-xs"
                      inputMode="decimal"
                      placeholder={decimals ? (0).toFixed(decimals) : undefined}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!locked ? (
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving..." : "Save Data"}
          </Button>
          <span className="text-xs text-muted-foreground">Tip: paste a block copied from Excel/CSV directly into any cell.</span>
          {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
