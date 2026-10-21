"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveMsaData, type DataPointInput } from "@/lib/actions/msa";
import { Button } from "@/components/ui/button";

type DataPoint = { appraiserIndex: number; partIndex: number; trialIndex: number; value: number | null };

function buildMatrix(appraisers: number, trials: number, parts: number, dataPoints: DataPoint[]): string[][][] {
  const matrix: string[][][] = Array.from({ length: appraisers }, () =>
    Array.from({ length: trials }, () => Array.from({ length: parts }, () => "")),
  );
  for (const dp of dataPoints) {
    if (dp.appraiserIndex < appraisers && dp.trialIndex < trials && dp.partIndex < parts && dp.value !== null) {
      matrix[dp.appraiserIndex][dp.trialIndex][dp.partIndex] = String(dp.value);
    }
  }
  return matrix;
}

export function MsaDataGrid({
  studyId,
  ppapElementId,
  locked,
  parts,
  appraisers,
  trials,
  appraiserNames,
  dataPoints,
}: {
  studyId: string;
  ppapElementId: string;
  locked: boolean;
  parts: number;
  appraisers: number;
  trials: number;
  appraiserNames: string[];
  dataPoints: DataPoint[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [matrix, setMatrix] = useState<string[][][]>(() => buildMatrix(appraisers, trials, parts, dataPoints));
  const [message, setMessage] = useState<string | null>(null);

  const partLabels = useMemo(() => Array.from({ length: parts }, (_, i) => `Part ${i + 1}`), [parts]);
  const rowCount = appraisers * trials;

  function setCell(rowIndex: number, colIndex: number, value: string) {
    const a = Math.floor(rowIndex / trials);
    const t = rowIndex % trials;
    setMatrix((prev) => {
      const next = prev.map((byTrial) => byTrial.map((byPart) => [...byPart]));
      next[a][t][colIndex] = value;
      return next;
    });
  }

  function handlePaste(rowIndex: number, colIndex: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\t") && !text.includes("\n")) return; // let a single value paste normally
    e.preventDefault();
    const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.length > 0);
    setMatrix((prev) => {
      const next = prev.map((byTrial) => byTrial.map((byPart) => [...byPart]));
      lines.forEach((line, i) => {
        const cells = line.split("\t");
        cells.forEach((cell, j) => {
          const r = rowIndex + i;
          const c = colIndex + j;
          if (r < rowCount && c < parts) {
            const a = Math.floor(r / trials);
            const t = r % trials;
            next[a][t][c] = cell.trim();
          }
        });
      });
      return next;
    });
  }

  function handleSave() {
    const points: DataPointInput[] = [];
    for (let a = 0; a < appraisers; a++) {
      for (let t = 0; t < trials; t++) {
        for (let p = 0; p < parts; p++) {
          const raw = matrix[a][t][p];
          const value = raw.trim() === "" ? null : Number(raw);
          points.push({ appraiserIndex: a, trialIndex: t, partIndex: p, value: value !== null && Number.isFinite(value) ? value : null });
        }
      }
    }
    startTransition(async () => {
      await saveMsaData(studyId, ppapElementId, points);
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
              <th className="border-b p-1.5 text-left font-semibold">Appraiser</th>
              <th className="border-b p-1.5 text-left font-semibold">Trial</th>
              {partLabels.map((label) => (
                <th key={label} className="border-b p-1.5 text-left font-semibold whitespace-nowrap">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: appraisers }, (_, a) =>
              Array.from({ length: trials }, (_, t) => {
                const rowIndex = a * trials + t;
                return (
                  <tr key={rowIndex} className="border-b">
                    {t === 0 ? (
                      <td className="p-1.5 font-medium align-top" rowSpan={trials}>
                        {appraiserNames[a] || `Appraiser ${String.fromCharCode(65 + a)}`}
                      </td>
                    ) : null}
                    <td className="p-1.5">Trial {t + 1}</td>
                    {Array.from({ length: parts }, (_, p) => (
                      <td key={p} className="p-1">
                        <input
                          aria-label={`${appraiserNames[a] || `Appraiser ${String.fromCharCode(65 + a)}`} trial ${t + 1} part ${p + 1}`}
                          value={matrix[a][t][p]}
                          disabled={locked}
                          onChange={(e) => setCell(rowIndex, p, e.target.value)}
                          onPaste={(e) => handlePaste(rowIndex, p, e)}
                          className="h-7 w-16 rounded-md border bg-transparent px-1 text-xs"
                          inputMode="decimal"
                        />
                      </td>
                    ))}
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
      {!locked ? (
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving..." : "Save Data"}
          </Button>
          <span className="text-xs text-muted-foreground">Tip: paste a block copied from Excel directly into any cell.</span>
          {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
