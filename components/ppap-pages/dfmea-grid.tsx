"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { flexRender, type CellContext, type ColumnDef } from "@tanstack/react-table";
import {
  getCoreRowModel,
  legacyCreateColumnHelper as createColumnHelper,
  useLegacyTable as useReactTable,
  type LegacyFeatures,
} from "@tanstack/react-table/legacy";
import { upsertDfmeaRow, deleteDfmeaRow, duplicateDfmeaRow } from "@/lib/actions/dfmea";
import { calculateRpn, SEVERITY_CRITERIA, OCCURRENCE_CRITERIA, DETECTION_CRITERIA } from "@/lib/calc/fmea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Prisma } from "@/app/generated/prisma/client";

type DfmeaRowData = Prisma.DfmeaRowGetPayload<object>;

type Draft = Partial<{
  item: string;
  potentialFailureMode: string;
  effects: string;
  severity: string;
  causes: string;
  occurrence: string;
  currentControlsPrevention: string;
  currentControlsDetection: string;
  detection: string;
  recommendedActions: string;
  responsibleId: string;
  targetDate: string;
  actionTaken: string;
  revisedSeverity: string;
  revisedOccurrence: string;
  revisedDetection: string;
}>;

// Everything a cell needs beyond the row itself flows through TanStack's
// `meta` option instead of column-def closures. flexRender's legacy shim
// treats `cell.column.columnDef.cell` as a React component *type*
// (`React.createElement(Comp, props)`), so if the column defs were rebuilt
// on every keystroke (e.g. via a useMemo keyed on draft state), each cell
// function would be a brand-new type every render — React would then
// unmount/remount the actual <textarea> each time, dropping focus before
// a blur event could ever reach our onBlur handler. Keeping the column
// defs (and therefore the cell component references) as a stable,
// module-level constant avoids that entirely; `meta` is free to change
// every render since it's just data read at render time, not a type.
type Meta = {
  getField: (row: DfmeaRowData, field: keyof Draft) => string;
  setField: (rowId: string, field: keyof Draft, value: string) => void;
  commitRow: (row: DfmeaRowData) => void;
  duplicateRow: (rowId: string) => void;
  deleteRow: (rowId: string) => void;
  locked: boolean;
  savingRowId: string | null;
  isPending: boolean;
  users: { id: string; name: string }[];
};

function meta(context: CellContext<LegacyFeatures, DfmeaRowData, unknown>): Meta {
  return context.table.options.meta as Meta;
}

function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

function fieldToString(v: number | string | Date | null | undefined): string {
  if (v == null) return "";
  if (v instanceof Date) return toDateInputValue(v);
  return String(v);
}

function SodInput({
  label,
  value,
  onChange,
  onBlur,
  disabled,
  criteria,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  disabled: boolean;
  criteria: Record<number, string>;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Input
            type="number"
            min={1}
            max={10}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            className="h-8 w-14"
            aria-label={label}
          />
        }
      />
      <TooltipContent className="max-w-xs text-xs">
        <p className="mb-1 font-semibold">{label} criteria (AIAG-style)</p>
        <ul className="space-y-0.5">
          {Object.entries(criteria)
            .sort((a, b) => Number(b[0]) - Number(a[0]))
            .map(([k, v]) => (
              <li key={k}>
                <span className="font-medium">{k}:</span> {v}
              </li>
            ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

function TextCell({
  ctx,
  field,
  label,
  className,
}: {
  ctx: CellContext<LegacyFeatures, DfmeaRowData, unknown>;
  field: keyof Draft;
  label: string;
  className?: string;
}) {
  const m = meta(ctx);
  const row = ctx.row.original;
  return (
    <Textarea
      aria-label={label}
      value={m.getField(row, field)}
      disabled={m.locked}
      onChange={(e) => m.setField(row.id, field, e.target.value)}
      onBlur={() => m.commitRow(row)}
      className={className ?? "h-16 w-36 text-xs"}
    />
  );
}

function SodCell({
  ctx,
  field,
  label,
  criteria,
}: {
  ctx: CellContext<LegacyFeatures, DfmeaRowData, unknown>;
  field: keyof Draft;
  label: string;
  criteria: Record<number, string>;
}) {
  const m = meta(ctx);
  const row = ctx.row.original;
  return (
    <SodInput
      label={label}
      value={m.getField(row, field)}
      onChange={(v) => m.setField(row.id, field, v)}
      onBlur={() => m.commitRow(row)}
      disabled={m.locked}
      criteria={criteria}
    />
  );
}

function rpnFromFields(ctx: CellContext<LegacyFeatures, DfmeaRowData, unknown>, s: keyof Draft, o: keyof Draft, d: keyof Draft) {
  const m = meta(ctx);
  const row = ctx.row.original;
  const sv = Number(m.getField(row, s));
  const ov = Number(m.getField(row, o));
  const dv = Number(m.getField(row, d));
  return sv && ov && dv ? calculateRpn(sv, ov, dv) : null;
}

const columnHelper = createColumnHelper<DfmeaRowData>();

const COLUMNS = [
  columnHelper.accessor("item", {
    header: "Item/Function",
    cell: (ctx) => <TextCell ctx={ctx} field="item" label="Item/Function" className="h-16 w-36 text-xs" />,
  }),
  columnHelper.accessor("potentialFailureMode", {
    header: "Potential Failure Mode",
    cell: (ctx) => (
      <TextCell ctx={ctx} field="potentialFailureMode" label="Potential Failure Mode" className="h-16 w-40 text-xs" />
    ),
  }),
  columnHelper.accessor("effects", {
    header: "Effects",
    cell: (ctx) => <TextCell ctx={ctx} field="effects" label="Effects" className="h-16 w-36 text-xs" />,
  }),
  columnHelper.accessor("severity", {
    header: "S",
    cell: (ctx) => <SodCell ctx={ctx} field="severity" label="Severity" criteria={SEVERITY_CRITERIA} />,
  }),
  columnHelper.accessor("causes", {
    header: "Causes",
    cell: (ctx) => <TextCell ctx={ctx} field="causes" label="Causes" className="h-16 w-36 text-xs" />,
  }),
  columnHelper.accessor("occurrence", {
    header: "O",
    cell: (ctx) => <SodCell ctx={ctx} field="occurrence" label="Occurrence" criteria={OCCURRENCE_CRITERIA} />,
  }),
  columnHelper.display({
    id: "controls",
    header: "Current Design Controls (Prevention/Detection)",
    cell: (ctx) => (
      <div className="space-y-1">
        <TextCell
          ctx={ctx}
          field="currentControlsPrevention"
          label="Current Controls — Prevention"
          className="h-10 w-40 text-xs"
        />
        <TextCell
          ctx={ctx}
          field="currentControlsDetection"
          label="Current Controls — Detection"
          className="h-10 w-40 text-xs"
        />
      </div>
    ),
  }),
  columnHelper.accessor("detection", {
    header: "D",
    cell: (ctx) => <SodCell ctx={ctx} field="detection" label="Detection" criteria={DETECTION_CRITERIA} />,
  }),
  columnHelper.display({
    id: "rpn",
    header: "RPN",
    cell: (ctx) => <span className="font-medium">{rpnFromFields(ctx, "severity", "occurrence", "detection") ?? "—"}</span>,
  }),
  columnHelper.accessor("recommendedActions", {
    header: "Recommended Actions",
    cell: (ctx) => (
      <TextCell ctx={ctx} field="recommendedActions" label="Recommended Actions" className="h-16 w-40 text-xs" />
    ),
  }),
  columnHelper.accessor("responsibleId", {
    header: "Responsibility",
    cell: (ctx) => {
      const m = meta(ctx);
      const row = ctx.row.original;
      return (
        <select
          aria-label="Responsibility"
          value={m.getField(row, "responsibleId")}
          disabled={m.locked}
          onChange={(e) => m.setField(row.id, "responsibleId", e.target.value)}
          onBlur={() => m.commitRow(row)}
          className="h-8 w-32 rounded-md border bg-transparent px-1 text-xs"
        >
          <option value="">—</option>
          {m.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      );
    },
  }),
  columnHelper.accessor("targetDate", {
    header: "Target Date",
    cell: (ctx) => {
      const m = meta(ctx);
      const row = ctx.row.original;
      return (
        <Input
          aria-label="Target Date"
          type="date"
          value={m.getField(row, "targetDate")}
          disabled={m.locked}
          onChange={(e) => m.setField(row.id, "targetDate", e.target.value)}
          onBlur={() => m.commitRow(row)}
          className="h-8 w-32 text-xs"
        />
      );
    },
  }),
  columnHelper.accessor("actionTaken", {
    header: "Action Taken",
    cell: (ctx) => <TextCell ctx={ctx} field="actionTaken" label="Action Taken" className="h-16 w-36 text-xs" />,
  }),
  columnHelper.accessor("revisedSeverity", {
    header: "Rev. S",
    cell: (ctx) => <SodCell ctx={ctx} field="revisedSeverity" label="Revised Severity" criteria={SEVERITY_CRITERIA} />,
  }),
  columnHelper.accessor("revisedOccurrence", {
    header: "Rev. O",
    cell: (ctx) => (
      <SodCell ctx={ctx} field="revisedOccurrence" label="Revised Occurrence" criteria={OCCURRENCE_CRITERIA} />
    ),
  }),
  columnHelper.accessor("revisedDetection", {
    header: "Rev. D",
    cell: (ctx) => <SodCell ctx={ctx} field="revisedDetection" label="Revised Detection" criteria={DETECTION_CRITERIA} />,
  }),
  columnHelper.display({
    id: "revisedRpn",
    header: "Revised RPN",
    cell: (ctx) => (
      <span className="font-medium">
        {rpnFromFields(ctx, "revisedSeverity", "revisedOccurrence", "revisedDetection") ?? "—"}
      </span>
    ),
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
          {m.savingRowId === row.id && m.isPending ? (
            <span className="text-xs text-muted-foreground">Saving...</span>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={() => m.duplicateRow(row.id)}>
            Duplicate
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => m.deleteRow(row.id)}>
            Delete
          </Button>
        </div>
      );
    },
  }),
] as ColumnDef<LegacyFeatures, DfmeaRowData, unknown>[];

export function DfmeaGrid({
  ppapElementId,
  locked,
  rows,
  users,
}: {
  ppapElementId: string;
  locked: boolean;
  rows: DfmeaRowData[];
  users: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // At most one upsertDfmeaRow request per row may be in flight at a time.
  // Each full-row upsert overwrites every field, so two overlapping saves
  // for the same row racing to finish (plausible under real network
  // latency, not just in a fast test) can let an earlier, less-complete
  // snapshot finish last and clobber a later one. inFlightRows/dirtyRows
  // turn concurrent blur-triggered saves into a simple "latest wins,
  // run next once the current save finishes" queue instead.
  const inFlightRows = useRef<Set<string>>(new Set());
  const dirtyRows = useRef<Set<string>>(new Set());
  const pendingSnapshots = useRef<Record<string, Draft>>({});

  // Field-blur saves can fire in rapid succession while tabbing through a
  // row. Calling router.refresh() synchronously after *each* one restarts
  // the Server Component fetch mid-interaction, which can race with focus
  // moving to the next field and silently swallow its blur. Debounce it so
  // it only runs once, after edits settle.
  function scheduleRefresh() {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), 600);
  }

  function getField(row: DfmeaRowData, field: keyof Draft): string {
    const draft = drafts[row.id]?.[field];
    if (draft !== undefined) return draft;
    const raw = row[field as keyof DfmeaRowData];
    return fieldToString(raw as never);
  }

  function setField(rowId: string, field: keyof Draft, value: string) {
    setDrafts((d) => ({ ...d, [rowId]: { ...d[rowId], [field]: value } }));
  }

  function commitRow(row: DfmeaRowData) {
    // Always record the latest desired state for this row...
    pendingSnapshots.current[row.id] = drafts[row.id] ?? {};
    if (inFlightRows.current.has(row.id)) {
      // ...but if a save for this row is already in flight, don't start a
      // second overlapping one — mark it dirty and let the in-flight save's
      // completion handler pick up the latest snapshot and run again.
      dirtyRows.current.add(row.id);
      return;
    }
    runSave(row);
  }

  function runSave(row: DfmeaRowData) {
    const snapshot = pendingSnapshots.current[row.id] ?? {};
    inFlightRows.current.add(row.id);
    dirtyRows.current.delete(row.id);
    setSavingRowId(row.id);
    startTransition(async () => {
      try {
        await upsertDfmeaRow(ppapElementId, {
          id: row.id,
          item: snapshot.item ?? fieldToString(row.item),
          potentialFailureMode: snapshot.potentialFailureMode ?? fieldToString(row.potentialFailureMode),
          effects: snapshot.effects ?? fieldToString(row.effects),
          severity: snapshot.severity ?? fieldToString(row.severity),
          causes: snapshot.causes ?? fieldToString(row.causes),
          occurrence: snapshot.occurrence ?? fieldToString(row.occurrence),
          currentControlsPrevention: snapshot.currentControlsPrevention ?? fieldToString(row.currentControlsPrevention),
          currentControlsDetection: snapshot.currentControlsDetection ?? fieldToString(row.currentControlsDetection),
          detection: snapshot.detection ?? fieldToString(row.detection),
          recommendedActions: snapshot.recommendedActions ?? fieldToString(row.recommendedActions),
          responsibleId: snapshot.responsibleId ?? fieldToString(row.responsibleId),
          targetDate: snapshot.targetDate ?? toDateInputValue(row.targetDate),
          actionTaken: snapshot.actionTaken ?? fieldToString(row.actionTaken),
          revisedSeverity: snapshot.revisedSeverity ?? fieldToString(row.revisedSeverity),
          revisedOccurrence: snapshot.revisedOccurrence ?? fieldToString(row.revisedOccurrence),
          revisedDetection: snapshot.revisedDetection ?? fieldToString(row.revisedDetection),
        });
        setDrafts((d) => {
          const current = d[row.id];
          if (!current) return d;
          const remaining = Object.fromEntries(
            Object.entries(current).filter(([key, value]) => value !== snapshot[key as keyof Draft]),
          ) as Draft;
          const next = { ...d };
          if (Object.keys(remaining).length > 0) {
            next[row.id] = remaining;
          } else {
            delete next[row.id];
          }
          return next;
        });
        scheduleRefresh();
      } finally {
        inFlightRows.current.delete(row.id);
        setSavingRowId(null);
        if (dirtyRows.current.has(row.id)) {
          runSave(row);
        }
      }
    });
  }

  function addRow() {
    startTransition(async () => {
      await upsertDfmeaRow(ppapElementId, {});
      router.refresh();
    });
  }

  function duplicateRow(rowId: string) {
    startTransition(async () => {
      await duplicateDfmeaRow(rowId, ppapElementId);
      router.refresh();
    });
  }

  function deleteRow(rowId: string) {
    startTransition(async () => {
      await deleteDfmeaRow(rowId, ppapElementId);
      router.refresh();
    });
  }

  // Group rows by "item" for visual separation, preserving original order.
  const groupedRows = useMemo(() => {
    const groups: { item: string; rows: DfmeaRowData[] }[] = [];
    for (const row of rows) {
      const key = row.item || "(no item)";
      const last = groups[groups.length - 1];
      if (last && last.item === key) {
        last.rows.push(row);
      } else {
        groups.push({ item: key, rows: [row] });
      }
    }
    return groups;
  }, [rows]);

  const tableMeta: Meta = {
    getField,
    setField,
    commitRow,
    duplicateRow,
    deleteRow,
    locked,
    savingRowId,
    isPending,
    users,
  };

  const table = useReactTable({
    data: rows,
    columns: COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.id,
    meta: tableMeta,
  });

  const rowById = new Map(table.getRowModel().rows.map((r) => [r.id, r]));

  return (
    <div className="space-y-2">
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
          {groupedRows.map((group) => (
            <tbody key={`group-${group.item}-${group.rows[0]?.id}`}>
              <tr className="bg-muted/20">
                <td colSpan={table.getFlatHeaders().length} className="p-1 text-xs font-semibold">
                  {group.item}
                </td>
              </tr>
              {group.rows.map((rowData) => {
                const row = rowById.get(rowData.id);
                if (!row) return null;
                return (
                  <tr key={row.id} className="border-b align-top">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="p-1.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          ))}
          {rows.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={table.getFlatHeaders().length} className="p-4 text-center text-muted-foreground">
                  No DFMEA rows yet.
                </td>
              </tr>
            </tbody>
          ) : null}
        </table>
      </div>
      {!locked ? (
        <Button type="button" size="sm" variant="outline" onClick={addRow} disabled={isPending}>
          Add row
        </Button>
      ) : null}
    </div>
  );
}
