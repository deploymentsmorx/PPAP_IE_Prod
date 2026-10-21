"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { flexRender, type CellContext, type ColumnDef } from "@tanstack/react-table";
import {
  getCoreRowModel,
  legacyCreateColumnHelper as createColumnHelper,
  useLegacyTable as useReactTable,
  type LegacyFeatures,
} from "@tanstack/react-table/legacy";
import { upsertRmtcRow, deleteRmtcRow, moveRmtcRow, uploadMtcFile, type RmtcRowInput } from "@/lib/actions/rmtc";
import { computePlateFlags, type PlateTolerance } from "@/lib/calc/plate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Prisma } from "@/app/generated/prisma/client";

type RowData = Prisma.RmtcReportRowGetPayload<object>;
type MaterialSpecOption = { id: string; standard: string; grade: string };

type Draft = Partial<{
  slNo: string;
  partNo: string;
  materialSpecId: string;
  requiredSizeText: string;
  qtyNos: string;
  observedSizeText: string;
  millTcNo: string;
  millTcDate: string;
  heatNo: string;
  plateNo: string;
  materialIdNo: string;
  labReportNo: string;
  remarks: string;
}>;

// See dimensional-report-grid.tsx for why column defs must be a stable
// module-level reference — the legacy flexRender shim uses the cell render
// function as a React component *type*, so rebuilding on every keystroke
// would remount inputs and drop focus before a blur could fire.
type Meta = {
  getField: (row: RowData, field: keyof Draft) => string;
  setField: (rowId: string, field: keyof Draft, value: string) => void;
  commitRow: (row: RowData) => void;
  deleteRow: (rowId: string) => void;
  moveRow: (rowId: string, direction: "up" | "down") => void;
  uploadFile: (rowId: string, file: File) => void;
  locked: boolean;
  savingRowId: string | null;
  uploadingRowId: string | null;
  materialSpecs: MaterialSpecOption[];
  ppapId: string;
  tolerance: PlateTolerance;
};

function meta(context: CellContext<LegacyFeatures, RowData, unknown>): Meta {
  return context.table.options.meta as Meta;
}

function fieldToString(v: string | number | null | undefined): string {
  if (v == null) return "";
  return String(v);
}

function toDateInputValue(v: Date | string | null | undefined): string {
  if (!v) return "";
  return new Date(v).toISOString().slice(0, 10);
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
      className={className ?? "h-8 w-24 text-xs"}
    />
  );
}

function MaterialSpecCell({ ctx }: { ctx: CellContext<LegacyFeatures, RowData, unknown> }) {
  const m = meta(ctx);
  const row = ctx.row.original;
  return (
    <select
      aria-label="Material Specification / Grade"
      value={m.getField(row, "materialSpecId")}
      disabled={m.locked}
      onChange={(e) => m.setField(row.id, "materialSpecId", e.target.value)}
      onBlur={() => m.commitRow(row)}
      className="h-8 w-36 rounded-md border bg-transparent px-1 text-xs"
    >
      <option value="">— None —</option>
      {m.materialSpecs.map((s) => (
        <option key={s.id} value={s.id}>
          {s.standard} {s.grade}
        </option>
      ))}
    </select>
  );
}

function plateFlagFor(m: Meta, row: RowData, getField: Meta["getField"]) {
  return computePlateFlags(getField(row, "requiredSizeText"), getField(row, "observedSizeText"), m.tolerance);
}

function ObservedSizeCell({ ctx }: { ctx: CellContext<LegacyFeatures, RowData, unknown> }) {
  const m = meta(ctx);
  const row = ctx.row.original;
  const flag = plateFlagFor(m, row, m.getField);
  return (
    <Input
      aria-label="Observed Size"
      value={m.getField(row, "observedSizeText")}
      disabled={m.locked}
      onChange={(e) => m.setField(row.id, "observedSizeText", e.target.value)}
      onBlur={() => m.commitRow(row)}
      className={cn("h-8 w-28 text-xs", flag.flagged ? "border-red-500 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-200" : undefined)}
    />
  );
}

function FlagCell({ ctx }: { ctx: CellContext<LegacyFeatures, RowData, unknown> }) {
  const m = meta(ctx);
  const row = ctx.row.original;
  const flag = plateFlagFor(m, row, m.getField);
  if (!flag.required || !flag.observed) return <Badge className="bg-muted text-muted-foreground">—</Badge>;
  if (!flag.flagged) return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">OK</Badge>;
  return (
    <Badge className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" title={flag.flaggedDims.join(", ")}>
      NG ({flag.flaggedDims.join("/")})
    </Badge>
  );
}

function MillTcCell({ ctx }: { ctx: CellContext<LegacyFeatures, RowData, unknown> }) {
  const m = meta(ctx);
  const row = ctx.row.original;
  return (
    <div className="space-y-1">
      <Input
        aria-label="Mill TC No"
        value={m.getField(row, "millTcNo")}
        disabled={m.locked}
        onChange={(e) => m.setField(row.id, "millTcNo", e.target.value)}
        onBlur={() => m.commitRow(row)}
        placeholder="TC No"
        className="h-7 w-32 text-[11px]"
      />
      <Input
        aria-label="Mill TC Date"
        type="date"
        value={m.getField(row, "millTcDate")}
        disabled={m.locked}
        onChange={(e) => m.setField(row.id, "millTcDate", e.target.value)}
        onBlur={() => m.commitRow(row)}
        className="h-7 w-32 text-[11px]"
      />
    </div>
  );
}

function LabReportCell({ ctx }: { ctx: CellContext<LegacyFeatures, RowData, unknown> }) {
  const m = meta(ctx);
  const row = ctx.row.original;
  const value = m.getField(row, "labReportNo");
  return (
    <div className="space-y-1">
      <Input
        aria-label="Lab Report No."
        value={value}
        disabled={m.locked}
        onChange={(e) => m.setField(row.id, "labReportNo", e.target.value)}
        onBlur={() => m.commitRow(row)}
        className="h-8 w-24 text-xs"
      />
      {value && value !== "-" ? (
        <Link href={`/ppap/${m.ppapId}/12`} className="text-[11px] text-primary underline">
          View page 12
        </Link>
      ) : null}
    </div>
  );
}

function MtcFileCell({ ctx }: { ctx: CellContext<LegacyFeatures, RowData, unknown> }) {
  const m = meta(ctx);
  const row = ctx.row.original;
  const inputRef = useRef<HTMLInputElement>(null);
  const uploading = m.uploadingRowId === row.id;

  return (
    <div className="space-y-1">
      {row.mtcFileUrl ? (
        <a href={row.mtcFileUrl} target="_blank" rel="noreferrer" className="block text-[11px] text-primary underline">
          {row.mtcFileName ?? "MTC PDF"}
        </a>
      ) : null}
      {!m.locked ? (
        <div className="flex items-center gap-1">
          <input ref={inputRef} type="file" accept="application/pdf" className="w-20 text-[10px]" />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-1 text-[10px]"
            disabled={uploading}
            onClick={() => {
              const file = inputRef.current?.files?.[0];
              if (file) m.uploadFile(row.id, file);
            }}
          >
            {uploading ? "..." : "Upload"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

const columnHelper = createColumnHelper<RowData>();

const COLUMNS = [
  columnHelper.accessor("slNo", { header: "Sl No", cell: (ctx) => <TextCell ctx={ctx} field="slNo" label="Sl No" className="h-8 w-14 text-xs" /> }),
  columnHelper.accessor("partNo", { header: "Part No", cell: (ctx) => <TextCell ctx={ctx} field="partNo" label="Part No" className="h-8 w-24 text-xs" /> }),
  columnHelper.display({ id: "materialSpec", header: "Material Spec / Grade", cell: (ctx) => <MaterialSpecCell ctx={ctx} /> }),
  columnHelper.accessor("requiredSizeText", {
    header: "Required Size (TxWxL)",
    cell: (ctx) => <TextCell ctx={ctx} field="requiredSizeText" label="Required Size" className="h-8 w-28 text-xs" />,
  }),
  columnHelper.accessor("qtyNos", { header: "Qty (Nos)", cell: (ctx) => <TextCell ctx={ctx} field="qtyNos" label="Qty (Nos)" className="h-8 w-14 text-xs" /> }),
  columnHelper.display({ id: "observedSize", header: "Observed Size", cell: (ctx) => <ObservedSizeCell ctx={ctx} /> }),
  columnHelper.display({ id: "flag", header: "Flag", cell: (ctx) => <FlagCell ctx={ctx} /> }),
  columnHelper.display({ id: "millTc", header: "Mill TC No. and Date", cell: (ctx) => <MillTcCell ctx={ctx} /> }),
  columnHelper.accessor("heatNo", { header: "Heat No", cell: (ctx) => <TextCell ctx={ctx} field="heatNo" label="Heat No" className="h-8 w-28 text-xs" /> }),
  columnHelper.accessor("plateNo", { header: "Plate No", cell: (ctx) => <TextCell ctx={ctx} field="plateNo" label="Plate No" className="h-8 w-20 text-xs" /> }),
  columnHelper.accessor("materialIdNo", {
    header: "Material Identification No",
    cell: (ctx) => <TextCell ctx={ctx} field="materialIdNo" label="Material Identification No" className="h-8 w-24 text-xs" />,
  }),
  columnHelper.display({ id: "labReportNo", header: "Lab Report No.", cell: (ctx) => <LabReportCell ctx={ctx} /> }),
  columnHelper.display({ id: "mtcFile", header: "MTC PDF", cell: (ctx) => <MtcFileCell ctx={ctx} /> }),
  columnHelper.accessor("remarks", { header: "Remarks", cell: (ctx) => <TextCell ctx={ctx} field="remarks" label="Remarks" className="h-8 w-28 text-xs" /> }),
  columnHelper.display({
    id: "actions",
    header: "",
    cell: (ctx) => {
      const m = meta(ctx);
      const row = ctx.row.original;
      if (m.locked) return null;
      return (
        <div className="flex flex-col gap-1">
          {m.savingRowId === row.id ? <span className="text-xs text-muted-foreground">Saving...</span> : null}
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

export function RmtcGrid({
  ppapId,
  ppapElementId,
  locked,
  rows,
  materialSpecs,
  tolerance,
}: {
  ppapId: string;
  ppapElementId: string;
  locked: boolean;
  rows: RowData[];
  materialSpecs: MaterialSpecOption[];
  tolerance: PlateTolerance;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [uploadingRowId, setUploadingRowId] = useState<string | null>(null);
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
    const draft = drafts[row.id]?.[field];
    if (draft !== undefined) return draft;
    if (field === "millTcDate") return toDateInputValue(row.millTcDate);
    if (field === "materialSpecId") return fieldToString(row.materialSpecId);
    return fieldToString(row[field as keyof RowData] as never);
  }

  function setField(rowId: string, field: keyof Draft, value: string) {
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
        const input: RmtcRowInput = {
          id: row.id,
          slNo: snapshot.slNo ?? fieldToString(row.slNo),
          partNo: snapshot.partNo ?? fieldToString(row.partNo),
          materialSpecId: snapshot.materialSpecId ?? fieldToString(row.materialSpecId),
          requiredSizeText: snapshot.requiredSizeText ?? fieldToString(row.requiredSizeText),
          qtyNos: snapshot.qtyNos ?? fieldToString(row.qtyNos),
          observedSizeText: snapshot.observedSizeText ?? fieldToString(row.observedSizeText),
          millTcNo: snapshot.millTcNo ?? fieldToString(row.millTcNo),
          millTcDate: snapshot.millTcDate ?? toDateInputValue(row.millTcDate),
          heatNo: snapshot.heatNo ?? fieldToString(row.heatNo),
          plateNo: snapshot.plateNo ?? fieldToString(row.plateNo),
          materialIdNo: snapshot.materialIdNo ?? fieldToString(row.materialIdNo),
          labReportNo: snapshot.labReportNo ?? fieldToString(row.labReportNo),
          remarks: snapshot.remarks ?? fieldToString(row.remarks),
        };
        await upsertRmtcRow(ppapElementId, input);

        setDrafts((d) => {
          const current = d[row.id];
          if (!current) return d;
          const remaining = Object.fromEntries(Object.entries(current).filter(([key, value]) => value !== snapshot[key as keyof Draft])) as Draft;
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

  function addRow() {
    startTransition(async () => {
      await upsertRmtcRow(ppapElementId, {});
      router.refresh();
    });
  }

  function deleteRow(rowId: string) {
    startTransition(async () => {
      await deleteRmtcRow(rowId, ppapElementId);
      router.refresh();
    });
  }

  function moveRow(rowId: string, direction: "up" | "down") {
    startTransition(async () => {
      await moveRmtcRow(rowId, ppapElementId, direction);
      router.refresh();
    });
  }

  function uploadFile(rowId: string, file: File) {
    setUploadingRowId(rowId);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        await uploadMtcFile(rowId, ppapElementId, formData);
        router.refresh();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Could not upload file.");
      } finally {
        setUploadingRowId(null);
      }
    });
  }

  const tableMeta: Meta = {
    getField,
    setField,
    commitRow,
    deleteRow,
    moveRow,
    uploadFile,
    locked,
    savingRowId,
    uploadingRowId,
    materialSpecs,
    ppapId,
    tolerance,
  };

  const table = useReactTable({
    data: rows,
    columns: COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.id,
    meta: tableMeta,
  });

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
                <td colSpan={columnCount} className="p-4 text-center text-muted-foreground">
                  No rows yet. Use &quot;Import Excel&quot; or add a row below.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {!locked ? (
        <Button type="button" size="sm" variant="outline" onClick={addRow} disabled={isPending}>
          + Add row
        </Button>
      ) : null}
    </div>
  );
}
