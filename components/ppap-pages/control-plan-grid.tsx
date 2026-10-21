"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { flexRender, type CellContext, type ColumnDef } from "@tanstack/react-table";
import {
  getCoreRowModel,
  legacyCreateColumnHelper as createColumnHelper,
  useLegacyTable as useReactTable,
  type LegacyFeatures,
} from "@tanstack/react-table/legacy";
import { upsertControlPlanRow, deleteControlPlanRow, moveControlPlanRow, generateFromPfc } from "@/lib/actions/control-plan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { Prisma } from "@/app/generated/prisma/client";

type ControlPlanRowData = Prisma.ControlPlanRowGetPayload<{ include: { instrument: true; specialCharacteristic: true } }>;
type InstrumentOption = { id: string; description: string; pickable: boolean; leastCount: string | null };
type SpecialCharOption = { id: string; characteristic: string; charClass: string; symbol: string | null };

type Draft = Partial<{
  processNameOperation: string;
  machineDeviceJigTools: string;
  stageNo: string;
  productCharacteristic: string;
  processCharacteristic: string;
  specialCharacteristicId: string;
  productProcessSpecification: string;
  evaluationMeasurementTechnique: string;
  instrumentId: string;
  leastCountText: string;
  controlInCharge: string;
  sampleSize: string;
  sampleFrequency: string;
  recordingRequired: string;
  controlMethod: string;
  reactionPlan: string;
}>;

// See pfmea-grid.tsx: column defs must stay a stable, module-level constant
// because flexRender's legacy shim uses the cell render function as a React
// component *type* — rebuilding it on every keystroke would remount inputs
// and drop focus before a blur could ever fire.
type Meta = {
  getField: (row: ControlPlanRowData, field: keyof Draft) => string;
  setField: (rowId: string, field: keyof Draft, value: string) => void;
  commitRow: (row: ControlPlanRowData) => void;
  deleteRow: (rowId: string) => void;
  moveRow: (rowId: string, direction: "up" | "down") => void;
  locked: boolean;
  savingRowId: string | null;
  isPending: boolean;
  instruments: InstrumentOption[];
  specialChars: SpecialCharOption[];
};

function meta(context: CellContext<LegacyFeatures, ControlPlanRowData, unknown>): Meta {
  return context.table.options.meta as Meta;
}

function fieldToString(v: number | string | boolean | null | undefined): string {
  if (v == null) return "";
  return String(v);
}

function TextCell({
  ctx,
  field,
  label,
  className,
}: {
  ctx: CellContext<LegacyFeatures, ControlPlanRowData, unknown>;
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
      className={className ?? "h-14 w-28 text-xs"}
    />
  );
}

function InputCell({
  ctx,
  field,
  label,
  className,
}: {
  ctx: CellContext<LegacyFeatures, ControlPlanRowData, unknown>;
  field: keyof Draft;
  label: string;
  className?: string;
}) {
  const m = meta(ctx);
  const row = ctx.row.original;
  return (
    <Input
      aria-label={label}
      value={m.getField(row, field)}
      disabled={m.locked}
      onChange={(e) => m.setField(row.id, field, e.target.value)}
      onBlur={() => m.commitRow(row)}
      className={className ?? "h-8 w-20 text-xs"}
    />
  );
}

function InstrumentCell({ ctx }: { ctx: CellContext<LegacyFeatures, ControlPlanRowData, unknown> }) {
  const m = meta(ctx);
  const row = ctx.row.original;
  const currentId = m.getField(row, "instrumentId");

  function handleChange(id: string) {
    m.setField(row.id, "instrumentId", id);
    const instrument = m.instruments.find((i) => i.id === id);
    const existingLeastCount = m.getField(row, "leastCountText");
    if (instrument?.leastCount && !existingLeastCount) {
      m.setField(row.id, "leastCountText", instrument.leastCount);
    }
  }

  return (
    <select
      aria-label="Instrument"
      value={currentId}
      disabled={m.locked}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={() => m.commitRow(row)}
      className="h-8 w-36 rounded-md border bg-transparent px-1 text-xs"
    >
      <option value="">— None —</option>
      {m.instruments.map((i) => (
        <option key={i.id} value={i.id} disabled={!i.pickable}>
          {i.description}
          {!i.pickable ? " (overdue)" : ""}
        </option>
      ))}
    </select>
  );
}

function SpecialCharCell({ ctx }: { ctx: CellContext<LegacyFeatures, ControlPlanRowData, unknown> }) {
  const m = meta(ctx);
  const row = ctx.row.original;
  const currentId = m.getField(row, "specialCharacteristicId");
  const selected = m.specialChars.find((s) => s.id === currentId);
  return (
    <div className="space-y-1">
      <select
        aria-label="Special Characteristic"
        value={currentId}
        disabled={m.locked}
        onChange={(e) => m.setField(row.id, "specialCharacteristicId", e.target.value)}
        onBlur={() => m.commitRow(row)}
        className="h-8 w-32 rounded-md border bg-transparent px-1 text-xs"
      >
        <option value="">— None —</option>
        {m.specialChars.map((s) => (
          <option key={s.id} value={s.id}>
            {s.characteristic}
          </option>
        ))}
      </select>
      {selected ? (
        <Badge variant={selected.charClass === "CRITICAL" ? "destructive" : "secondary"}>
          {selected.symbol ?? selected.charClass}
        </Badge>
      ) : null}
    </div>
  );
}

function RecordingCell({ ctx }: { ctx: CellContext<LegacyFeatures, ControlPlanRowData, unknown> }) {
  const m = meta(ctx);
  const row = ctx.row.original;
  return (
    <select
      aria-label="Recording"
      value={m.getField(row, "recordingRequired")}
      disabled={m.locked}
      onChange={(e) => m.setField(row.id, "recordingRequired", e.target.value)}
      onBlur={() => m.commitRow(row)}
      className="h-8 w-20 rounded-md border bg-transparent px-1 text-xs"
    >
      <option value="">—</option>
      <option value="true">Yes</option>
      <option value="false">No</option>
    </select>
  );
}

const columnHelper = createColumnHelper<ControlPlanRowData>();

const COLUMNS = [
  columnHelper.accessor("processNameOperation", {
    header: "Process Name / Operation Description",
    cell: (ctx) => <TextCell ctx={ctx} field="processNameOperation" label="Process Name / Operation Description" className="h-14 w-36 text-xs" />,
  }),
  columnHelper.accessor("machineDeviceJigTools", {
    header: "Machine/Device/Jig/Tools",
    cell: (ctx) => <TextCell ctx={ctx} field="machineDeviceJigTools" label="Machine/Device/Jig/Tools" />,
  }),
  columnHelper.accessor("stageNo", {
    header: "Stage No.",
    cell: (ctx) => <InputCell ctx={ctx} field="stageNo" label="Stage No." className="h-8 w-14 text-xs" />,
  }),
  columnHelper.accessor("productCharacteristic", {
    header: "Product Characteristic",
    cell: (ctx) => <TextCell ctx={ctx} field="productCharacteristic" label="Product Characteristic" />,
  }),
  columnHelper.accessor("processCharacteristic", {
    header: "Process Characteristic",
    cell: (ctx) => <TextCell ctx={ctx} field="processCharacteristic" label="Process Characteristic" />,
  }),
  columnHelper.display({
    id: "specialCharacteristic",
    header: "Special Char. Class",
    cell: (ctx) => <SpecialCharCell ctx={ctx} />,
  }),
  columnHelper.accessor("productProcessSpecification", {
    header: "Product/Process Specification/Tolerance",
    cell: (ctx) => <TextCell ctx={ctx} field="productProcessSpecification" label="Product/Process Specification/Tolerance" className="h-14 w-36 text-xs" />,
  }),
  columnHelper.accessor("evaluationMeasurementTechnique", {
    header: "Evaluation/Measurement Technique",
    cell: (ctx) => <TextCell ctx={ctx} field="evaluationMeasurementTechnique" label="Evaluation/Measurement Technique" />,
  }),
  columnHelper.display({
    id: "instrument",
    header: "Instrument",
    cell: (ctx) => <InstrumentCell ctx={ctx} />,
  }),
  columnHelper.accessor("leastCountText", {
    header: "Least Count",
    cell: (ctx) => <InputCell ctx={ctx} field="leastCountText" label="Least Count" />,
  }),
  columnHelper.accessor("controlInCharge", {
    header: "Control In-charge",
    cell: (ctx) => <InputCell ctx={ctx} field="controlInCharge" label="Control In-charge (W | P | I | Q | P & Q)" />,
  }),
  columnHelper.accessor("sampleSize", {
    header: "Sample Size",
    cell: (ctx) => <InputCell ctx={ctx} field="sampleSize" label="Sample Size" />,
  }),
  columnHelper.accessor("sampleFrequency", {
    header: "Frequency",
    cell: (ctx) => <InputCell ctx={ctx} field="sampleFrequency" label="Frequency" />,
  }),
  columnHelper.display({
    id: "recording",
    header: "Recording",
    cell: (ctx) => <RecordingCell ctx={ctx} />,
  }),
  columnHelper.accessor("controlMethod", {
    header: "Control Method",
    cell: (ctx) => <TextCell ctx={ctx} field="controlMethod" label="Control Method" className="h-14 w-36 text-xs" />,
  }),
  columnHelper.accessor("reactionPlan", {
    header: "Reaction Plan",
    cell: (ctx) => <InputCell ctx={ctx} field="reactionPlan" label="Reaction Plan (A | B | C | D)" className="h-8 w-16 text-xs" />,
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
] as ColumnDef<LegacyFeatures, ControlPlanRowData, unknown>[];

export function ControlPlanGrid({
  ppapElementId,
  locked,
  rows,
  instruments,
  specialChars,
}: {
  ppapElementId: string;
  locked: boolean;
  rows: ControlPlanRowData[];
  instruments: InstrumentOption[];
  specialChars: SpecialCharOption[];
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

  function getField(row: ControlPlanRowData, field: keyof Draft): string {
    const draft = drafts[row.id]?.[field];
    if (draft !== undefined) return draft;
    const raw = row[field as keyof ControlPlanRowData];
    return fieldToString(raw as never);
  }

  function setField(rowId: string, field: keyof Draft, value: string) {
    setDrafts((d) => ({ ...d, [rowId]: { ...d[rowId], [field]: value } }));
  }

  function commitRow(row: ControlPlanRowData) {
    pendingSnapshots.current[row.id] = drafts[row.id] ?? {};
    if (inFlightRows.current.has(row.id)) {
      dirtyRows.current.add(row.id);
      return;
    }
    runSave(row);
  }

  function runSave(row: ControlPlanRowData) {
    const snapshot = pendingSnapshots.current[row.id] ?? {};
    inFlightRows.current.add(row.id);
    dirtyRows.current.delete(row.id);
    setSavingRowId(row.id);
    startTransition(async () => {
      try {
        await upsertControlPlanRow(ppapElementId, {
          id: row.id,
          processNameOperation: snapshot.processNameOperation ?? fieldToString(row.processNameOperation),
          machineDeviceJigTools: snapshot.machineDeviceJigTools ?? fieldToString(row.machineDeviceJigTools),
          stageNo: snapshot.stageNo ?? fieldToString(row.stageNo),
          productCharacteristic: snapshot.productCharacteristic ?? fieldToString(row.productCharacteristic),
          processCharacteristic: snapshot.processCharacteristic ?? fieldToString(row.processCharacteristic),
          specialCharacteristicId: snapshot.specialCharacteristicId ?? fieldToString(row.specialCharacteristicId),
          productProcessSpecification: snapshot.productProcessSpecification ?? fieldToString(row.productProcessSpecification),
          evaluationMeasurementTechnique: snapshot.evaluationMeasurementTechnique ?? fieldToString(row.evaluationMeasurementTechnique),
          instrumentId: snapshot.instrumentId ?? fieldToString(row.instrumentId),
          leastCountText: snapshot.leastCountText ?? fieldToString(row.leastCountText),
          controlInCharge: snapshot.controlInCharge ?? fieldToString(row.controlInCharge),
          sampleSize: snapshot.sampleSize ?? fieldToString(row.sampleSize),
          sampleFrequency: snapshot.sampleFrequency ?? fieldToString(row.sampleFrequency),
          recordingRequired: snapshot.recordingRequired ?? fieldToString(row.recordingRequired),
          controlMethod: snapshot.controlMethod ?? fieldToString(row.controlMethod),
          reactionPlan: snapshot.reactionPlan ?? fieldToString(row.reactionPlan),
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
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Could not save row.");
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
      await upsertControlPlanRow(ppapElementId, {});
      router.refresh();
    });
  }

  function deleteRow(rowId: string) {
    startTransition(async () => {
      await deleteControlPlanRow(rowId, ppapElementId);
      router.refresh();
    });
  }

  function moveRow(rowId: string, direction: "up" | "down") {
    startTransition(async () => {
      await moveControlPlanRow(rowId, ppapElementId, direction);
      router.refresh();
    });
  }

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateFromPfc(ppapElementId);
      setMessage(`Generated from PFC/PFMEA: ${result.added} row(s) added.`);
      router.refresh();
    });
  }

  const tableMeta: Meta = {
    getField,
    setField,
    commitRow,
    deleteRow,
    moveRow,
    locked,
    savingRowId,
    isPending,
    instruments,
    specialChars,
  };

  const table = useReactTable({
    data: rows,
    columns: COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.id,
    meta: tableMeta,
  });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {!locked ? (
          <>
            <Button type="button" size="sm" variant="outline" onClick={handleGenerate} disabled={isPending}>
              Generate from PFC/PFMEA
            </Button>
            <Button type="button" size="sm" onClick={addRow} disabled={isPending}>
              + Add row
            </Button>
          </>
        ) : null}
      </div>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}

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
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b align-top">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="p-1.5">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={table.getFlatHeaders().length} className="p-4 text-center text-muted-foreground">
                  No rows yet. Use &quot;Generate from PFC/PFMEA&quot; or add one manually.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
