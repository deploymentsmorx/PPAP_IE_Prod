"use client";

import { Fragment, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { flexRender, type CellContext, type ColumnDef } from "@tanstack/react-table";
import {
  getCoreRowModel,
  legacyCreateColumnHelper as createColumnHelper,
  useLegacyTable as useReactTable,
  type LegacyFeatures,
} from "@tanstack/react-table/legacy";
import { upsertDimensionalReportRow, deleteDimensionalReportRow, moveDimensionalReportRow, upsertReading } from "@/lib/actions/dimensional-report";
import { parseDimensionAndTolerance, computeStatus, type ReadingStatus } from "@/lib/calc/tolerance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Prisma } from "@/app/generated/prisma/client";

type RowData = Prisma.DimensionalReportRowGetPayload<{ include: { readings: true; instrument: true } }>;
type SampleColumn = { id: string; label: string };
type InstrumentOption = { id: string; description: string; pickable: boolean };

type Draft = Partial<{
  slNo: string;
  parameterDescription: string;
  designDimensionText: string;
  toleranceText: string;
  instrumentId: string;
  instrumentUsedText: string;
  remarks: string;
}> &
  Record<string, string>; // reading_<sampleColumnId> entries

function readingDraftKey(columnId: string) {
  return `reading_${columnId}`;
}

// See pfmea-grid.tsx for why column defs must be a stable reference — the
// legacy flexRender shim uses the cell render function as a React
// component *type*, so rebuilding column defs on every keystroke would
// remount the inputs and drop focus before a blur could fire. The fixed
// columns here are a module-level constant like every other grid; the
// per-report reading columns are dynamic (user-configurable sample
// columns), so they're rebuilt only when the set of column IDs actually
// changes (useMemo keyed on that id list, not on draft state).
type Meta = {
  getField: (row: RowData, field: keyof Draft) => string;
  setField: (rowId: string, field: string, value: string) => void;
  commitRow: (row: RowData) => void;
  deleteRow: (rowId: string) => void;
  moveRow: (rowId: string, direction: "up" | "down") => void;
  locked: boolean;
  savingRowId: string | null;
  isPending: boolean;
  instruments: InstrumentOption[];
  sampleColumns: SampleColumn[];
};

function meta(context: CellContext<LegacyFeatures, RowData, unknown>): Meta {
  return context.table.options.meta as Meta;
}

function fieldToString(v: string | number | null | undefined): string {
  if (v == null) return "";
  return String(v);
}

function statusBadgeClass(status: ReadingStatus): string {
  if (status === "OK") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
  if (status === "NG") return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
  return "bg-muted text-muted-foreground";
}

function TextCell({ ctx, field, label, className }: { ctx: CellContext<LegacyFeatures, RowData, unknown>; field: keyof Draft; label: string; className?: string }) {
  const m = meta(ctx);
  const row = ctx.row.original;
  return (
    <Input
      aria-label={label}
      value={m.getField(row, field)}
      disabled={m.locked}
      onChange={(e) => m.setField(row.id, field, e.target.value)}
      onBlur={() => m.commitRow(row)}
      className={className ?? "h-8 w-28 text-xs"}
    />
  );
}

function InstrumentCell({ ctx }: { ctx: CellContext<LegacyFeatures, RowData, unknown> }) {
  const m = meta(ctx);
  const row = ctx.row.original;
  return (
    <div className="space-y-1">
      <select
        aria-label="Instrument"
        value={m.getField(row, "instrumentId")}
        disabled={m.locked}
        onChange={(e) => m.setField(row.id, "instrumentId", e.target.value)}
        onBlur={() => m.commitRow(row)}
        className="h-7 w-32 rounded-md border bg-transparent px-1 text-[11px]"
      >
        <option value="">— None —</option>
        {m.instruments.map((i) => (
          <option key={i.id} value={i.id} disabled={!i.pickable}>
            {i.description}
            {!i.pickable ? " (overdue)" : ""}
          </option>
        ))}
      </select>
      <Input
        aria-label="Instrument Used (code)"
        value={m.getField(row, "instrumentUsedText")}
        disabled={m.locked}
        onChange={(e) => m.setField(row.id, "instrumentUsedText", e.target.value)}
        onBlur={() => m.commitRow(row)}
        placeholder="e.g. MT"
        className="h-7 w-32 text-[11px]"
      />
    </div>
  );
}

function parsedBandFor(row: RowData) {
  return parseDimensionAndTolerance(row.designDimensionText, row.toleranceText);
}

function ReadingCell({ ctx, column }: { ctx: CellContext<LegacyFeatures, RowData, unknown>; column: SampleColumn }) {
  const m = meta(ctx);
  const row = ctx.row.original;
  const key = readingDraftKey(column.id);
  const value = m.getField(row, key as keyof Draft);
  const band = parsedBandFor(row);
  const status = computeStatus(value.trim() === "" ? null : Number(value), band);

  return (
    <Input
      aria-label={`${column.label} reading`}
      value={value}
      disabled={m.locked}
      onChange={(e) => m.setField(row.id, key, e.target.value)}
      onBlur={() => m.commitRow(row)}
      className={cn("h-8 w-20 text-xs", status === "NG" ? "border-red-500 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-200" : undefined)}
    />
  );
}

function StatusCell({ ctx }: { ctx: CellContext<LegacyFeatures, RowData, unknown> }) {
  const m = meta(ctx);
  const row = ctx.row.original;
  const band = parsedBandFor(row);
  const values = m.sampleColumns
    .map((c) => m.getField(row, readingDraftKey(c.id) as keyof Draft))
    .filter((v) => v.trim() !== "")
    .map((v) => Number(v));
  if (values.length === 0) return <Badge className={statusBadgeClass("UNKNOWN")}>—</Badge>;
  const anyNg = values.some((v) => computeStatus(v, band) === "NG");
  const status: ReadingStatus = band ? (anyNg ? "NG" : "OK") : "UNKNOWN";
  return <Badge className={statusBadgeClass(status)}>{status === "UNKNOWN" ? "—" : status}</Badge>;
}

const columnHelper = createColumnHelper<RowData>();

const FIXED_COLUMNS_BEFORE_READINGS = [
  columnHelper.accessor("slNo", {
    header: "Sl No",
    cell: (ctx) => <TextCell ctx={ctx} field="slNo" label="Sl No" className="h-8 w-16 text-xs" />,
  }),
  columnHelper.accessor("parameterDescription", {
    header: "Parameter Description",
    cell: (ctx) => <TextCell ctx={ctx} field="parameterDescription" label="Parameter Description" className="h-8 w-32 text-xs" />,
  }),
  columnHelper.accessor("designDimensionText", {
    header: "Dim",
    cell: (ctx) => <TextCell ctx={ctx} field="designDimensionText" label="Design Dimension" className="h-8 w-20 text-xs" />,
  }),
  columnHelper.accessor("toleranceText", {
    header: "Tol",
    cell: (ctx) => <TextCell ctx={ctx} field="toleranceText" label="Tolerance" className="h-8 w-20 text-xs" />,
  }),
  columnHelper.display({
    id: "instrument",
    header: "Instrument Used",
    cell: (ctx) => <InstrumentCell ctx={ctx} />,
  }),
] as ColumnDef<LegacyFeatures, RowData, unknown>[];

const FIXED_COLUMNS_AFTER_READINGS = [
  columnHelper.display({
    id: "status",
    header: "Status",
    cell: (ctx) => <StatusCell ctx={ctx} />,
  }),
  columnHelper.accessor("remarks", {
    header: "Remarks",
    cell: (ctx) => <TextCell ctx={ctx} field="remarks" label="Remarks" className="h-8 w-28 text-xs" />,
  }),
  columnHelper.display({
    id: "actions",
    header: "",
    cell: (ctx) => {
      const m = meta(ctx);
      const row = ctx.row.original;
      if (m.locked) return null;
      return (
        <div className="flex flex-col gap-1">
          {m.savingRowId === row.id && m.isPending ? <span className="text-xs text-muted-foreground">Saving...</span> : null}
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => m.moveRow(row.id, "up")}>
              ↑
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => m.moveRow(row.id, "down")}>
              ↓
            </Button>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => m.deleteRow(row.id)}>
            Delete
          </Button>
        </div>
      );
    },
  }),
] as ColumnDef<LegacyFeatures, RowData, unknown>[];

export function DimensionalReportGrid({
  ppapElementId,
  locked,
  rows,
  instruments,
  sampleColumns,
}: {
  ppapElementId: string;
  locked: boolean;
  rows: RowData[];
  instruments: InstrumentOption[];
  sampleColumns: SampleColumn[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRows = useRef<Set<string>>(new Set());
  const dirtyRows = useRef<Set<string>>(new Set());
  const pendingSnapshots = useRef<Record<string, Draft>>({});
  const [message, setMessage] = useState<string | null>(null);

  function scheduleRefresh() {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), 600);
  }

  function getField(row: RowData, field: keyof Draft): string {
    const draft = drafts[row.id]?.[field as string];
    if (draft !== undefined) return draft;
    if (typeof field === "string" && field.startsWith("reading_")) {
      const columnId = field.slice("reading_".length);
      const reading = row.readings.find((r) => r.sampleColumnId === columnId);
      return fieldToString(reading?.value ?? null);
    }
    const raw = row[field as keyof RowData];
    return fieldToString(raw as never);
  }

  function setField(rowId: string, field: string, value: string) {
    setDrafts((d) => ({ ...d, [rowId]: { ...d[rowId], [field]: value } }));
  }

  function commitRow(row: RowData) {
    pendingSnapshots.current[row.id] = drafts[row.id] ?? {};
    if (inFlightRows.current.has(row.id)) {
      dirtyRows.current.add(row.id);
      return;
    }
    runSave(row);
  }

  function runSave(row: RowData) {
    const snapshot = pendingSnapshots.current[row.id] ?? {};
    inFlightRows.current.add(row.id);
    dirtyRows.current.delete(row.id);
    setSavingRowId(row.id);
    startTransition(async () => {
      try {
        await upsertDimensionalReportRow(ppapElementId, {
          id: row.id,
          slNo: snapshot.slNo ?? fieldToString(row.slNo),
          view: row.view ?? undefined,
          parameterDescription: snapshot.parameterDescription ?? fieldToString(row.parameterDescription),
          designDimensionText: snapshot.designDimensionText ?? fieldToString(row.designDimensionText),
          toleranceText: snapshot.toleranceText ?? fieldToString(row.toleranceText),
          instrumentId: snapshot.instrumentId ?? fieldToString(row.instrumentId),
          instrumentUsedText: snapshot.instrumentUsedText ?? fieldToString(row.instrumentUsedText),
          remarks: snapshot.remarks ?? fieldToString(row.remarks),
        });

        for (const sampleColumn of sampleColumns) {
          const key = readingDraftKey(sampleColumn.id);
          if (snapshot[key] === undefined) continue;
          const existing = row.readings.find((r) => r.sampleColumnId === sampleColumn.id);
          if (snapshot[key] === fieldToString(existing?.value ?? null)) continue;
          await upsertReading(ppapElementId, row.id, sampleColumn.id, snapshot[key]);
        }

        setDrafts((d) => {
          const current = d[row.id];
          if (!current) return d;
          const remaining = Object.fromEntries(Object.entries(current).filter(([key, value]) => value !== snapshot[key])) as Draft;
          const next = { ...d };
          if (Object.keys(remaining).length > 0) next[row.id] = remaining;
          else delete next[row.id];
          return next;
        });
        scheduleRefresh();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Could not save row.");
      } finally {
        inFlightRows.current.delete(row.id);
        setSavingRowId(null);
        if (dirtyRows.current.has(row.id)) runSave(row);
      }
    });
  }

  function addRow(view: string | null) {
    startTransition(async () => {
      await upsertDimensionalReportRow(ppapElementId, { view: view ?? undefined });
      router.refresh();
    });
  }

  function deleteRow(rowId: string) {
    startTransition(async () => {
      await deleteDimensionalReportRow(rowId, ppapElementId);
      router.refresh();
    });
  }

  function moveRow(rowId: string, direction: "up" | "down") {
    startTransition(async () => {
      await moveDimensionalReportRow(rowId, ppapElementId, direction);
      router.refresh();
    });
  }

  const readingColumnIdsKey = sampleColumns.map((c) => c.id).join(",");
  const COLUMNS = useMemo(() => {
    const readingColumns = sampleColumns.map((col) =>
      columnHelper.display({
        id: `reading-${col.id}`,
        header: col.label,
        cell: (ctx) => <ReadingCell ctx={ctx} column={col} />,
      }),
    );
    return [...FIXED_COLUMNS_BEFORE_READINGS, ...readingColumns, ...FIXED_COLUMNS_AFTER_READINGS] as ColumnDef<LegacyFeatures, RowData, unknown>[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readingColumnIdsKey]);

  const groups = useMemo(() => {
    const byView = new Map<string, RowData[]>();
    for (const row of rows) {
      const key = row.view ?? "(no view)";
      if (!byView.has(key)) byView.set(key, []);
      byView.get(key)!.push(row);
    }
    return [...byView.entries()];
  }, [rows]);

  const tableMeta: Meta = { getField, setField, commitRow, deleteRow, moveRow, locked, savingRowId, isPending, instruments, sampleColumns };

  const table = useReactTable({
    data: rows,
    columns: COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.id,
    meta: tableMeta,
  });

  const rowById = new Map(table.getRowModel().rows.map((r) => [r.id, r]));
  const columnCount = table.getFlatHeaders().length;

  return (
    <div className="space-y-2">
      {message ? <p className="text-xs text-destructive">{message}</p> : null}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/50">
              {table.getFlatHeaders().map((header) => (
                <th key={header.id} className="border-b p-1.5 text-left font-semibold whitespace-nowrap">
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          </thead>
          {groups.map(([view, viewRows]) => (
            <tbody key={view}>
              <tr className="bg-muted/20">
                <td colSpan={columnCount} className="p-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{view}</span>
                    {!locked ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => addRow(view === "(no view)" ? null : view)}>
                        + Add row
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
              {viewRows.map((rowData) => {
                const row = rowById.get(rowData.id);
                if (!row) return null;
                return (
                  <Fragment key={row.id}>
                    <tr className="border-b align-top">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="p-1.5">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          ))}
          {rows.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={columnCount} className="p-4 text-center text-muted-foreground">
                  No rows yet. Use &quot;Generate from Balloons&quot; or Import Excel below.
                </td>
              </tr>
            </tbody>
          ) : null}
        </table>
      </div>
      {!locked ? (
        <Button type="button" size="sm" variant="outline" onClick={() => addRow(null)}>
          + Add row (no view)
        </Button>
      ) : null}
    </div>
  );
}
