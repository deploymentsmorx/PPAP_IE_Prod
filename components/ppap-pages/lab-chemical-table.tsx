"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveChemicalResult } from "@/lib/actions/lab";
import { computeNumericStatus } from "@/lib/calc/lab";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Prisma } from "@/app/generated/prisma/client";

type Row = Prisma.LabChemicalResultGetPayload<object>;

const ELEMENT_LABEL: Record<string, string> = {
  C: "C",
  MN: "Mn",
  SI: "Si",
  S: "S",
  P: "P",
  CR: "Cr",
  NI: "Ni",
  MO: "Mo",
  OTHER: "Other",
};

function requirementLabel(row: Row): string {
  if (row.requirementMin != null && row.requirementMax != null) return `${row.requirementMin}-${row.requirementMax}`;
  if (row.requirementMin != null) return `Min ${row.requirementMin}`;
  if (row.requirementMax != null) return `Max ${row.requirementMax}`;
  if (row.requirementText) return row.requirementText;
  return "—";
}

function statusBadgeClass(status: string): string {
  if (status === "OK") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
  if (status === "NG") return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
  return "bg-muted text-muted-foreground";
}

export function LabChemicalTable({ ppapElementId, locked, rows }: { ppapElementId: string; locked: boolean; rows: Row[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  function getResult(row: Row): string {
    const draft = drafts[row.id];
    if (draft !== undefined) return draft;
    return row.result != null ? String(row.result) : "";
  }

  function commit(row: Row) {
    const raw = getResult(row);
    const parsed = raw.trim() === "" ? null : Number(raw);
    startTransition(async () => {
      await saveChemicalResult(ppapElementId, row.id, { result: parsed !== null && Number.isFinite(parsed) ? parsed : null });
      router.refresh();
    });
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-muted/50">
            <th className="border-b p-1.5 text-left font-semibold">Element</th>
            <th className="border-b p-1.5 text-left font-semibold">Min</th>
            <th className="border-b p-1.5 text-left font-semibold">Max</th>
            <th className="border-b p-1.5 text-left font-semibold">Result</th>
            <th className="border-b p-1.5 text-left font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const resultValue = getResult(row);
            const numericResult = resultValue.trim() === "" ? null : Number(resultValue);
            const status = computeNumericStatus(numericResult, row.requirementMin, row.requirementMax);
            return (
              <tr key={row.id} className="border-b align-top">
                <td className="p-1.5 font-medium">{ELEMENT_LABEL[row.element] ?? row.element}</td>
                <td className="p-1.5">{row.requirementMin ?? (row.element === "OTHER" ? requirementLabel(row) : "—")}</td>
                <td className="p-1.5">{row.requirementMax ?? "—"}</td>
                <td className="p-1.5">
                  <Input
                    aria-label={`${ELEMENT_LABEL[row.element] ?? row.element} result`}
                    value={resultValue}
                    disabled={locked}
                    onChange={(e) => setDrafts((d) => ({ ...d, [row.id]: e.target.value }))}
                    onBlur={() => commit(row)}
                    className={cn("h-8 w-20 text-xs", status === "NG" ? "border-red-500 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-200" : undefined)}
                  />
                </td>
                <td className="p-1.5">
                  <Badge className={statusBadgeClass(status)}>{status === "UNKNOWN" ? "—" : status}</Badge>
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
