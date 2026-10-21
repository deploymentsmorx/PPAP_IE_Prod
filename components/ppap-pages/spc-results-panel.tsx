"use client";

import { useState, useTransition } from "react";
import { copySpcSummaryToChecklist } from "@/lib/actions/spc";
import type { SpcStudyResults } from "@/lib/actions/spc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const VERDICT_LABEL: Record<string, string> = {
  ACCEPTABLE: "Acceptable",
  CONDITIONAL: "Conditional",
  NOT_ACCEPTABLE: "Not acceptable",
};

const VERDICT_CLASS: Record<string, string> = {
  ACCEPTABLE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  CONDITIONAL: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  NOT_ACCEPTABLE: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

function fmt(n: number, digits = 3): string {
  return n.toFixed(digits);
}

export function SpcResultsPanel({ ppapId, results }: { ppapId: string; results: SpcStudyResults }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (!results.complete) {
    return (
      <div className="rounded-md border p-3 text-sm text-muted-foreground">
        Data grid is {results.filled} of {results.expected} cells filled — results compute automatically once every cell has a
        value and USL/LSL are set.
      </div>
    );
  }

  function handleCopy() {
    startTransition(async () => {
      await copySpcSummaryToChecklist(ppapId);
      setMessage("Copied to Checklist.");
    });
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg font-semibold">Cpk {fmt(results.clientCpk)}</span>
        <Badge variant="outline" className={cn(VERDICT_CLASS[results.verdict], "border-0")}>
          {VERDICT_LABEL[results.verdict]}
        </Badge>
        <Badge variant="outline" className="border-0 bg-muted">
          {results.aboveUsl + results.belowLsl} out of spec
        </Badge>
        <Button type="button" size="sm" variant="outline" onClick={handleCopy} disabled={isPending}>
          {isPending ? "Copying..." : "Copy summary to Checklist"}
        </Button>
        {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
      </div>

      <p className="text-xs text-muted-foreground">{results.remark}</p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/50">
              <th className="border-b p-1.5 text-left font-semibold"></th>
              <th className="border-b p-1.5 text-left font-semibold">Cp / Pp</th>
              <th className="border-b p-1.5 text-left font-semibold">Cpk / Ppk</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border-b p-1.5 font-medium">Standard (σ within = R̄/d2)</td>
              <td className="border-b p-1.5">{fmt(results.cp)}</td>
              <td className="border-b p-1.5">{fmt(results.cpk)}</td>
            </tr>
            <tr>
              <td className="border-b p-1.5 font-medium">Overall (σ overall = STDEV)</td>
              <td className="border-b p-1.5">{fmt(results.pp)}</td>
              <td className="border-b p-1.5">{fmt(results.ppk)}</td>
            </tr>
            <tr>
              <td className="p-1.5 font-medium">Client method (K={fmt(results.clientK, 4)})</td>
              <td className="p-1.5">{fmt(results.clientCp)}</td>
              <td className="p-1.5">{fmt(results.clientCpk)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
        <span>X̄̄ = {fmt(results.xBarBar)}</span>
        <span>R̄ = {fmt(results.rBar)}</span>
        <span>σ within = {fmt(results.sigmaWithin)}</span>
        <span>σ overall = {fmt(results.sigmaOverall)}</span>
        <span>Above USL: {results.aboveUsl}</span>
        <span>Below LSL: {results.belowLsl}</span>
      </div>
    </div>
  );
}
