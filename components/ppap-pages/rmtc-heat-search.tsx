"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { searchByHeatNo } from "@/lib/actions/rmtc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Result = Awaited<ReturnType<typeof searchByHeatNo>>[number];

export function RmtcHeatSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSearch() {
    startTransition(async () => {
      const r = await searchByHeatNo(query);
      setResults(r);
    });
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">Heat No traceability</span>
        <Input
          aria-label="Search Heat No"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search heat no..."
          className="h-8 w-48 text-xs"
        />
        <Button type="button" size="sm" variant="outline" disabled={isPending || !query.trim()} onClick={handleSearch}>
          {isPending ? "Searching..." : "Search"}
        </Button>
      </div>
      {results ? (
        results.length === 0 ? (
          <p className="text-xs text-muted-foreground">No lots found for &quot;{query}&quot;.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="p-1">Heat No</th>
                  <th className="p-1">Part No</th>
                  <th className="p-1">Customer</th>
                  <th className="p-1">Lot (Sl No)</th>
                  <th className="p-1">Lab Report No.</th>
                  <th className="p-1">PPAP</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.rowId} className="border-t">
                    <td className="p-1">{r.heatNo}</td>
                    <td className="p-1">
                      {r.partNumber} Rev {r.revision}
                    </td>
                    <td className="p-1">{r.customerName}</td>
                    <td className="p-1">#{r.slNo}</td>
                    <td className="p-1">{r.labReportNo || "-"}</td>
                    <td className="p-1">
                      <Link href={`/ppap/${r.ppapId}/10`} className="text-primary underline">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </div>
  );
}
