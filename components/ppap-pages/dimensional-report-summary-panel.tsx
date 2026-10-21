"use client";

import { useState, useTransition } from "react";
import { copyDimensionalReportSummaryToChecklist } from "@/lib/actions/dimensional-report";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type NgRow = { rowId: string; slNo: string; view: string | null };

export function DimensionalReportSummaryPanel({
  ppapId,
  total,
  checked,
  ok,
  ng,
  pctConformance,
  ngRows,
}: {
  ppapId: string;
  total: number;
  checked: number;
  ok: number;
  ng: number;
  pctConformance: number;
  ngRows: NgRow[];
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleCopy() {
    startTransition(async () => {
      await copyDimensionalReportSummaryToChecklist(ppapId);
      setMessage("Copied to Checklist.");
    });
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">
          {total} rows — {checked} checked, {ok} OK, {ng} NG
        </span>
        <Badge variant="outline" className="border-0 bg-muted">
          {pctConformance}% conformance
        </Badge>
        <Badge variant={ng > 0 ? "destructive" : "outline"} className={ng === 0 ? "border-0 bg-muted" : undefined}>
          {ng} NG
        </Badge>
        <Button type="button" size="sm" variant="outline" onClick={handleCopy} disabled={isPending}>
          {isPending ? "Copying..." : "Copy summary to Checklist"}
        </Button>
        {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
      </div>
      {ngRows.length > 0 ? (
        <div className="text-xs">
          <span className="font-medium">NG rows: </span>
          {ngRows.map((r, i) => (
            <span key={r.rowId}>
              {i > 0 ? ", " : ""}
              {r.view ? `${r.view} ` : ""}#{r.slNo}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
