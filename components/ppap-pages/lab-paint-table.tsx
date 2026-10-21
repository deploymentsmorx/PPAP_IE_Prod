"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePaintResult } from "@/lib/actions/lab";
import { computeNumericStatus } from "@/lib/calc/lab";
import { parseRangeText } from "@/lib/calc/tolerance";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Prisma } from "@/app/generated/prisma/client";

type Row = Prisma.LabPaintResultGetPayload<object>;

const PROPERTY_LABEL: Record<string, string> = {
  DFT: "DFT",
  ADHESION: "Adhesion",
  GLOSS: "Gloss",
  VISUAL: "Visual",
};

function statusBadgeClass(status: string): string {
  if (status === "OK") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
  if (status === "NG") return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
  return "bg-muted text-muted-foreground";
}

export function LabPaintTable({ ppapElementId, locked, rows }: { ppapElementId: string; locked: boolean; rows: Row[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, { resultText: string; unit: string; remark: string }>>({});

  function getField(row: Row, field: "resultText" | "unit" | "remark"): string {
    const draft = drafts[row.id]?.[field];
    if (draft !== undefined) return draft;
    if (field === "resultText") return row.resultText ?? "";
    return (row[field] as string | null) ?? "";
  }

  function setField(row: Row, field: "resultText" | "unit" | "remark", value: string) {
    setDrafts((d) => {
      const current = d[row.id] ?? { resultText: getField(row, "resultText"), unit: getField(row, "unit"), remark: getField(row, "remark") };
      return { ...d, [row.id]: { ...current, [field]: value } };
    });
  }

  function commit(row: Row) {
    const resultText = getField(row, "resultText");
    const unit = getField(row, "unit");
    const remark = getField(row, "remark");
    startTransition(async () => {
      await savePaintResult(ppapElementId, row.id, { resultText: resultText || null, unit: unit || null, remark: remark || null });
      router.refresh();
    });
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-muted/50">
            <th className="border-b p-1.5 text-left font-semibold">Property</th>
            <th className="border-b p-1.5 text-left font-semibold">Requirement</th>
            <th className="border-b p-1.5 text-left font-semibold">Result</th>
            <th className="border-b p-1.5 text-left font-semibold">Unit</th>
            <th className="border-b p-1.5 text-left font-semibold">Status</th>
            <th className="border-b p-1.5 text-left font-semibold">Remark</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const resultValue = getField(row, "resultText");
            const numericResult = resultValue.trim() === "" ? null : Number(resultValue);
            const range = parseRangeText(row.requirementText);
            const status = range && Number.isFinite(numericResult) ? computeNumericStatus(numericResult, range.min, range.max) : "UNKNOWN";
            return (
              <tr key={row.id} className="border-b align-top">
                <td className="p-1.5 font-medium">{PROPERTY_LABEL[row.property] ?? row.property}</td>
                <td className="p-1.5">{row.requirementText || "—"}</td>
                <td className="p-1.5">
                  <Input
                    aria-label={`${PROPERTY_LABEL[row.property] ?? row.property} result`}
                    value={resultValue}
                    disabled={locked}
                    onChange={(e) => setField(row, "resultText", e.target.value)}
                    onBlur={() => commit(row)}
                    className={cn("h-8 w-24 text-xs", status === "NG" ? "border-red-500 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-200" : undefined)}
                  />
                </td>
                <td className="p-1.5">
                  <Input
                    aria-label={`${PROPERTY_LABEL[row.property] ?? row.property} unit`}
                    value={getField(row, "unit")}
                    disabled={locked}
                    onChange={(e) => setField(row, "unit", e.target.value)}
                    onBlur={() => commit(row)}
                    className="h-8 w-16 text-xs"
                  />
                </td>
                <td className="p-1.5">
                  <Badge className={statusBadgeClass(status)}>{status === "UNKNOWN" ? "—" : status}</Badge>
                </td>
                <td className="p-1.5">
                  <Input
                    aria-label={`${PROPERTY_LABEL[row.property] ?? row.property} remark`}
                    value={getField(row, "remark")}
                    disabled={locked}
                    onChange={(e) => setField(row, "remark", e.target.value)}
                    onBlur={() => commit(row)}
                    className="h-8 w-28 text-xs"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {isPending ? <p className="p-1.5 text-[10px] text-muted-foreground">Saving...</p> : null}
    </div>
  );
}
