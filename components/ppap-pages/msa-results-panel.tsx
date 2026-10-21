"use client";

import { useTransition } from "react";
import { copyMsaSummaryToChecklist } from "@/lib/actions/msa";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GrrResult, MsaVerdict } from "@/lib/calc/grr";

const VERDICT_LABEL: Record<MsaVerdict, string> = {
  ACCEPTABLE: "Acceptable",
  CONDITIONALLY_ACCEPTABLE: "Conditionally acceptable",
  NOT_ACCEPTABLE: "Not acceptable",
};

const VERDICT_CLASS: Record<MsaVerdict, string> = {
  ACCEPTABLE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  CONDITIONALLY_ACCEPTABLE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  NOT_ACCEPTABLE: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

function fmt(n: number, digits = 3): string {
  return n.toFixed(digits);
}

export function MsaResultsPanel({
  ppapId,
  complete,
  filled,
  expected,
  result,
}: {
  ppapId: string;
  complete: boolean;
  filled: number;
  expected: number;
  result: GrrResult | null;
}) {
  const [isPending, startTransition] = useTransition();

  if (!complete || !result) {
    return (
      <div className="rounded-md border p-3 text-sm text-muted-foreground">
        Data grid is {filled} of {expected} cells filled. Results compute automatically once every cell has a value.
      </div>
    );
  }

  const summary = `GRR ${result.pctGrrOfTv.toFixed(1)}% (${VERDICT_LABEL[result.verdict]}), ndc ${result.ndc}`;

  function handleCopy() {
    startTransition(async () => {
      await copyMsaSummaryToChecklist(ppapId, summary);
    });
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg font-semibold">GRR {result.pctGrrOfTv.toFixed(1)}%</span>
        <Badge variant="outline" className={cn(VERDICT_CLASS[result.verdict], "border-0")}>
          {VERDICT_LABEL[result.verdict]}
        </Badge>
        <Badge variant={result.ndc >= 5 ? "outline" : "destructive"} className={result.ndc >= 5 ? "border-0 bg-muted" : undefined}>
          ndc {result.ndc} {result.ndc >= 5 ? "(OK)" : "(< 5)"}
        </Badge>
        <Button type="button" size="sm" variant="outline" onClick={handleCopy} disabled={isPending}>
          {isPending ? "Copying..." : "Copy summary to Checklist"}
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/50">
              <th className="border-b p-1.5 text-left font-semibold"></th>
              <th className="border-b p-1.5 text-left font-semibold">Value</th>
              <th className="border-b p-1.5 text-left font-semibold">% of TV</th>
              {result.tolerance != null ? <th className="border-b p-1.5 text-left font-semibold">% of Tolerance</th> : null}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border-b p-1.5 font-medium">EV (Repeatability)</td>
              <td className="border-b p-1.5">{fmt(result.ev)}</td>
              <td className="border-b p-1.5">{fmt(result.pctEvOfTv, 1)}%</td>
              {result.tolerance != null ? <td className="border-b p-1.5">{fmt(result.pctEvOfTolerance!, 1)}%</td> : null}
            </tr>
            <tr>
              <td className="border-b p-1.5 font-medium">AV (Reproducibility)</td>
              <td className="border-b p-1.5">{fmt(result.av)}</td>
              <td className="border-b p-1.5">{fmt(result.pctAvOfTv, 1)}%</td>
              {result.tolerance != null ? <td className="border-b p-1.5">{fmt(result.pctAvOfTolerance!, 1)}%</td> : null}
            </tr>
            <tr>
              <td className="border-b p-1.5 font-medium">GRR</td>
              <td className="border-b p-1.5">{fmt(result.grr)}</td>
              <td className="border-b p-1.5">{fmt(result.pctGrrOfTv, 1)}%</td>
              {result.tolerance != null ? <td className="border-b p-1.5">{fmt(result.pctGrrOfTolerance!, 1)}%</td> : null}
            </tr>
            <tr>
              <td className="border-b p-1.5 font-medium">PV (Part Variation)</td>
              <td className="border-b p-1.5">{fmt(result.pv)}</td>
              <td className="border-b p-1.5">{fmt(result.pctPvOfTv, 1)}%</td>
              {result.tolerance != null ? <td className="border-b p-1.5">{fmt(result.pctPvOfTolerance!, 1)}%</td> : null}
            </tr>
            <tr>
              <td className="p-1.5 font-medium">TV (Total Variation)</td>
              <td className="p-1.5">{fmt(result.tv)}</td>
              <td className="p-1.5">100%</td>
              {result.tolerance != null ? <td className="p-1.5">{fmt((100 * result.tv) / result.tolerance, 1)}%</td> : null}
            </tr>
          </tbody>
        </table>
      </div>
      {result.tolerance != null ? (
        <p className="text-xs text-muted-foreground">Tolerance (USL − LSL) = {fmt(result.tolerance, 3)}</p>
      ) : null}
    </div>
  );
}
