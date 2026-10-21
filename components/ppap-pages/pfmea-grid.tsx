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
import {
  upsertPfmeaRow,
  deletePfmeaRow,
  addProcessStep,
  deleteProcessStep,
  syncFromPfc,
  insertFromLibrary,
  saveRowAsTemplate,
  getFailureModeTemplates,
  sendActionReminders,
} from "@/lib/actions/pfmea";
import { calculateRpn, SEVERITY_CRITERIA, OCCURRENCE_CRITERIA, DETECTION_CRITERIA } from "@/lib/calc/fmea";
import { calculateActionPriority, parseApText, type ApLevel } from "@/lib/calc/ap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Prisma } from "@/app/generated/prisma/client";

type PfmeaRowData = Prisma.PfmeaRowGetPayload<object>;
type PfmeaStepData = Prisma.PfmeaProcessStepGetPayload<{ include: { rows: true } }>;
type Operation = { id: string; code: string; name: string };

type Draft = Partial<{
  processFunction: string;
  potentialFailureMode: string;
  potentialEffect: string;
  severity: string;
  potentialCause: string;
  occurrence: string;
  currentPreventionControls: string;
  currentDetectionControls: string;
  detection: string;
  recommendedActions: string;
  responsibleId: string;
  responsibleText: string;
  targetDate: string;
  actionTaken: string;
  revisedSeverity: string;
  revisedOccurrence: string;
  revisedDetection: string;
  revisionNo: string;
  revisionDate: string;
}>;

// See components/ppap-pages/dfmea-grid.tsx for why column defs must stay a
// stable, module-level constant (flexRender's legacy shim uses the cell
// function as a React component *type*; rebuilding it on every keystroke
// would remount the inputs and drop focus before a blur could ever fire).
type Meta = {
  getField: (row: PfmeaRowData, field: keyof Draft) => string;
  setField: (rowId: string, field: keyof Draft, value: string) => void;
  commitRow: (row: PfmeaRowData) => void;
  deleteRow: (rowId: string) => void;
  openSaveTemplate: (rowId: string) => void;
  locked: boolean;
  savingRowId: string | null;
  isPending: boolean;
  users: { id: string; name: string }[];
};

function meta(context: CellContext<LegacyFeatures, PfmeaRowData, unknown>): Meta {
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

function apBadgeVariant(ap: ApLevel): "destructive" | "secondary" | "outline" {
  if (ap === "HIGH") return "destructive";
  if (ap === "MEDIUM") return "secondary";
  return "outline";
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
  ctx: CellContext<LegacyFeatures, PfmeaRowData, unknown>;
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
      className={className ?? "h-14 w-32 text-xs"}
    />
  );
}

function SodCell({
  ctx,
  field,
  label,
  criteria,
}: {
  ctx: CellContext<LegacyFeatures, PfmeaRowData, unknown>;
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

function sodNumbers(ctx: CellContext<LegacyFeatures, PfmeaRowData, unknown>, s: keyof Draft, o: keyof Draft, d: keyof Draft) {
  const m = meta(ctx);
  const row = ctx.row.original;
  const sv = Number(m.getField(row, s));
  const ov = Number(m.getField(row, o));
  const dv = Number(m.getField(row, d));
  return sv && ov && dv ? { sv, ov, dv } : null;
}

function RpnCell({ ctx, s, o, d }: { ctx: CellContext<LegacyFeatures, PfmeaRowData, unknown>; s: keyof Draft; o: keyof Draft; d: keyof Draft }) {
  const nums = sodNumbers(ctx, s, o, d);
  return <span className="font-medium">{nums ? calculateRpn(nums.sv, nums.ov, nums.dv) : "—"}</span>;
}

function ApCell({
  ctx,
  s,
  o,
  d,
  importedField,
}: {
  ctx: CellContext<LegacyFeatures, PfmeaRowData, unknown>;
  s: keyof Draft;
  o: keyof Draft;
  d: keyof Draft;
  importedField?: "importedApText" | "importedRevisedApText";
}) {
  const nums = sodNumbers(ctx, s, o, d);
  if (!nums) return <span className="text-muted-foreground">—</span>;
  const computed = calculateActionPriority(nums.sv, nums.ov, nums.dv);
  const row = ctx.row.original;
  const importedText = importedField ? row[importedField] : null;
  const typed = parseApText(importedText);
  const mismatch = typed && typed !== computed;
  return (
    <div className="flex items-center gap-1">
      <Badge variant={apBadgeVariant(computed)}>{computed}</Badge>
      {mismatch ? (
        <Tooltip>
          <TooltipTrigger render={<span className="cursor-help text-destructive">⚠</span>} />
          <TooltipContent className="text-xs">Imported sheet said &quot;{importedText}&quot;, computed value disagrees.</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}

const columnHelper = createColumnHelper<PfmeaRowData>();

const COLUMNS = [
  columnHelper.accessor("processFunction", {
    header: "Process Function",
    cell: (ctx) => <TextCell ctx={ctx} field="processFunction" label="Process Function" />,
  }),
  columnHelper.accessor("potentialFailureMode", {
    header: "Potential Failure Mode",
    cell: (ctx) => <TextCell ctx={ctx} field="potentialFailureMode" label="Potential Failure Mode" />,
  }),
  columnHelper.accessor("potentialEffect", {
    header: "Potential Effect",
    cell: (ctx) => <TextCell ctx={ctx} field="potentialEffect" label="Potential Effect" />,
  }),
  columnHelper.accessor("severity", {
    header: "S",
    cell: (ctx) => <SodCell ctx={ctx} field="severity" label="Severity" criteria={SEVERITY_CRITERIA} />,
  }),
  columnHelper.accessor("potentialCause", {
    header: "Potential Cause",
    cell: (ctx) => <TextCell ctx={ctx} field="potentialCause" label="Potential Cause" />,
  }),
  columnHelper.accessor("occurrence", {
    header: "O",
    cell: (ctx) => <SodCell ctx={ctx} field="occurrence" label="Occurrence" criteria={OCCURRENCE_CRITERIA} />,
  }),
  columnHelper.accessor("currentPreventionControls", {
    header: "Current Prevention Controls",
    cell: (ctx) => <TextCell ctx={ctx} field="currentPreventionControls" label="Current Prevention Controls" />,
  }),
  columnHelper.accessor("currentDetectionControls", {
    header: "Current Detection Controls",
    cell: (ctx) => <TextCell ctx={ctx} field="currentDetectionControls" label="Current Detection Controls" />,
  }),
  columnHelper.accessor("detection", {
    header: "D",
    cell: (ctx) => <SodCell ctx={ctx} field="detection" label="Detection" criteria={DETECTION_CRITERIA} />,
  }),
  columnHelper.display({
    id: "rpn",
    header: "RPN",
    cell: (ctx) => <RpnCell ctx={ctx} s="severity" o="occurrence" d="detection" />,
  }),
  columnHelper.display({
    id: "ap",
    header: "Action Priority",
    cell: (ctx) => <ApCell ctx={ctx} s="severity" o="occurrence" d="detection" importedField="importedApText" />,
  }),
  columnHelper.accessor("recommendedActions", {
    header: "Recommended Actions",
    cell: (ctx) => <TextCell ctx={ctx} field="recommendedActions" label="Recommended Actions" />,
  }),
  columnHelper.display({
    id: "responsible",
    header: "Responsible Person",
    cell: (ctx) => {
      const m = meta(ctx);
      const row = ctx.row.original;
      return (
        <div className="space-y-1">
          <select
            aria-label="Responsible Person (registered user)"
            value={m.getField(row, "responsibleId")}
            disabled={m.locked}
            onChange={(e) => m.setField(row.id, "responsibleId", e.target.value)}
            onBlur={() => m.commitRow(row)}
            className="h-7 w-28 rounded-md border bg-transparent px-1 text-[10px]"
          >
            <option value="">— None —</option>
            {m.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <Input
            aria-label="Responsible Person (role/name text)"
            value={m.getField(row, "responsibleText")}
            disabled={m.locked}
            onChange={(e) => m.setField(row.id, "responsibleText", e.target.value)}
            onBlur={() => m.commitRow(row)}
            placeholder="or type role/name"
            className="h-7 w-28 text-[10px]"
          />
        </div>
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
    cell: (ctx) => <TextCell ctx={ctx} field="actionTaken" label="Action Taken" />,
  }),
  columnHelper.accessor("revisedSeverity", {
    header: "Rev. S",
    cell: (ctx) => <SodCell ctx={ctx} field="revisedSeverity" label="Revised Severity" criteria={SEVERITY_CRITERIA} />,
  }),
  columnHelper.accessor("revisedOccurrence", {
    header: "Rev. O",
    cell: (ctx) => <SodCell ctx={ctx} field="revisedOccurrence" label="Revised Occurrence" criteria={OCCURRENCE_CRITERIA} />,
  }),
  columnHelper.accessor("revisedDetection", {
    header: "Rev. D",
    cell: (ctx) => <SodCell ctx={ctx} field="revisedDetection" label="Revised Detection" criteria={DETECTION_CRITERIA} />,
  }),
  columnHelper.display({
    id: "revisedAp",
    header: "Revised AP",
    cell: (ctx) => <ApCell ctx={ctx} s="revisedSeverity" o="revisedOccurrence" d="revisedDetection" importedField="importedRevisedApText" />,
  }),
  columnHelper.accessor("revisionNo", {
    header: "Revision No",
    cell: (ctx) => {
      const m = meta(ctx);
      const row = ctx.row.original;
      return (
        <Input
          aria-label="Revision No"
          value={m.getField(row, "revisionNo")}
          disabled={m.locked}
          onChange={(e) => m.setField(row.id, "revisionNo", e.target.value)}
          onBlur={() => m.commitRow(row)}
          className="h-8 w-20 text-xs"
        />
      );
    },
  }),
  columnHelper.accessor("revisionDate", {
    header: "Revision Date",
    cell: (ctx) => {
      const m = meta(ctx);
      const row = ctx.row.original;
      return (
        <Input
          aria-label="Revision Date"
          type="date"
          value={m.getField(row, "revisionDate")}
          disabled={m.locked}
          onChange={(e) => m.setField(row.id, "revisionDate", e.target.value)}
          onBlur={() => m.commitRow(row)}
          className="h-8 w-32 text-xs"
        />
      );
    },
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
          <Button type="button" variant="ghost" size="sm" onClick={() => m.openSaveTemplate(row.id)}>
            Save as template
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => m.deleteRow(row.id)}>
            Delete
          </Button>
        </div>
      );
    },
  }),
] as ColumnDef<LegacyFeatures, PfmeaRowData, unknown>[];

function LibraryInsertPanel({
  ppapElementId,
  pfmeaProcessStepId,
  operations,
  onDone,
}: {
  ppapElementId: string;
  pfmeaProcessStepId: string;
  operations: Operation[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [operationId, setOperationId] = useState("");
  type Template = Awaited<ReturnType<typeof getFailureModeTemplates>>[number];
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState("");

  function handleOperationChange(id: string) {
    setOperationId(id);
    setTemplateId("");
    const op = operations.find((o) => o.id === id);
    startTransition(async () => {
      const list = op ? await getFailureModeTemplates(op.code) : [];
      setTemplates(list);
    });
  }

  function handleInsert() {
    if (!templateId) return;
    startTransition(async () => {
      await insertFromLibrary(ppapElementId, pfmeaProcessStepId, templateId);
      router.refresh();
      onDone();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-background p-2 text-xs">
      <select value={operationId} onChange={(e) => handleOperationChange(e.target.value)} className="h-7 rounded-md border bg-transparent px-1 text-xs">
        <option value="">— Operation —</option>
        {operations.map((op) => (
          <option key={op.id} value={op.id}>
            {op.name}
          </option>
        ))}
      </select>
      <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} disabled={!operationId} className="h-7 w-56 rounded-md border bg-transparent px-1 text-xs">
        <option value="">— Template —</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.potentialFailureMode || "(untitled)"}
          </option>
        ))}
      </select>
      <Button type="button" size="sm" disabled={!templateId || isPending} onClick={handleInsert}>
        Insert
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onDone}>
        Cancel
      </Button>
    </div>
  );
}

function SaveTemplatePanel({
  rowId,
  operations,
  onDone,
}: {
  rowId: string;
  operations: Operation[];
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [operationId, setOperationId] = useState("");

  function handleSave() {
    if (!operationId) return;
    startTransition(async () => {
      await saveRowAsTemplate(rowId, operationId);
      onDone();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-background p-2 text-xs">
      <span>Save this row as a template for:</span>
      <select value={operationId} onChange={(e) => setOperationId(e.target.value)} className="h-7 rounded-md border bg-transparent px-1 text-xs">
        <option value="">— Operation —</option>
        {operations.map((op) => (
          <option key={op.id} value={op.id}>
            {op.name}
          </option>
        ))}
      </select>
      <Button type="button" size="sm" disabled={!operationId || isPending} onClick={handleSave}>
        {isPending ? "Saving..." : "Save"}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onDone}>
        Cancel
      </Button>
    </div>
  );
}

type Filters = { highApOnly: boolean; openOnly: boolean; overdueOnly: boolean };

function rowMatchesFilters(row: PfmeaRowData, filters: Filters): boolean {
  if (filters.highApOnly) {
    if (!(row.severity && row.occurrence && row.detection)) return false;
    if (calculateActionPriority(row.severity, row.occurrence, row.detection) !== "HIGH") return false;
  }
  const isOpen = Boolean(row.recommendedActions) && !row.actionTaken;
  if (filters.openOnly && !isOpen) return false;
  if (filters.overdueOnly) {
    if (!isOpen || !row.targetDate || row.targetDate >= new Date()) return false;
  }
  return true;
}

export function PfmeaGrid({
  ppapElementId,
  locked,
  steps,
  users,
  operations,
}: {
  ppapElementId: string;
  locked: boolean;
  steps: PfmeaStepData[];
  users: { id: string; name: string }[];
  operations: Operation[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRows = useRef<Set<string>>(new Set());
  const dirtyRows = useRef<Set<string>>(new Set());
  const pendingSnapshots = useRef<Record<string, Draft>>({});
  const [libraryPanelStepId, setLibraryPanelStepId] = useState<string | null>(null);
  const [templatePanelRowId, setTemplatePanelRowId] = useState<string | null>(null);
  const [newStepName, setNewStepName] = useState("");
  const [showAddStep, setShowAddStep] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ highApOnly: false, openOnly: false, overdueOnly: false });

  function scheduleRefresh() {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), 600);
  }

  function getField(row: PfmeaRowData, field: keyof Draft): string {
    const draft = drafts[row.id]?.[field];
    if (draft !== undefined) return draft;
    const raw = row[field as keyof PfmeaRowData];
    return fieldToString(raw as never);
  }

  function setField(rowId: string, field: keyof Draft, value: string) {
    setDrafts((d) => ({ ...d, [rowId]: { ...d[rowId], [field]: value } }));
  }

  function commitRow(row: PfmeaRowData) {
    pendingSnapshots.current[row.id] = drafts[row.id] ?? {};
    if (inFlightRows.current.has(row.id)) {
      dirtyRows.current.add(row.id);
      return;
    }
    runSave(row);
  }

  function runSave(row: PfmeaRowData) {
    const snapshot = pendingSnapshots.current[row.id] ?? {};
    inFlightRows.current.add(row.id);
    dirtyRows.current.delete(row.id);
    setSavingRowId(row.id);
    startTransition(async () => {
      try {
        await upsertPfmeaRow(ppapElementId, {
          id: row.id,
          pfmeaProcessStepId: row.pfmeaProcessStepId,
          processFunction: snapshot.processFunction ?? fieldToString(row.processFunction),
          potentialFailureMode: snapshot.potentialFailureMode ?? fieldToString(row.potentialFailureMode),
          potentialEffect: snapshot.potentialEffect ?? fieldToString(row.potentialEffect),
          severity: snapshot.severity ?? fieldToString(row.severity),
          potentialCause: snapshot.potentialCause ?? fieldToString(row.potentialCause),
          occurrence: snapshot.occurrence ?? fieldToString(row.occurrence),
          currentPreventionControls: snapshot.currentPreventionControls ?? fieldToString(row.currentPreventionControls),
          currentDetectionControls: snapshot.currentDetectionControls ?? fieldToString(row.currentDetectionControls),
          detection: snapshot.detection ?? fieldToString(row.detection),
          recommendedActions: snapshot.recommendedActions ?? fieldToString(row.recommendedActions),
          responsibleId: snapshot.responsibleId ?? fieldToString(row.responsibleId),
          responsibleText: snapshot.responsibleText ?? fieldToString(row.responsibleText),
          targetDate: snapshot.targetDate ?? toDateInputValue(row.targetDate),
          actionTaken: snapshot.actionTaken ?? fieldToString(row.actionTaken),
          revisedSeverity: snapshot.revisedSeverity ?? fieldToString(row.revisedSeverity),
          revisedOccurrence: snapshot.revisedOccurrence ?? fieldToString(row.revisedOccurrence),
          revisedDetection: snapshot.revisedDetection ?? fieldToString(row.revisedDetection),
          revisionNo: snapshot.revisionNo ?? fieldToString(row.revisionNo),
          revisionDate: snapshot.revisionDate ?? toDateInputValue(row.revisionDate),
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

  function addRow(stepId: string) {
    startTransition(async () => {
      await upsertPfmeaRow(ppapElementId, { pfmeaProcessStepId: stepId });
      router.refresh();
    });
  }

  function deleteRow(rowId: string) {
    startTransition(async () => {
      await deletePfmeaRow(rowId, ppapElementId);
      router.refresh();
    });
  }

  function handleSync() {
    startTransition(async () => {
      const result = await syncFromPfc(ppapElementId);
      setMessage(`Synced from PFC: ${result.added} step(s) added, ${result.flaggedRemoved} flagged as no longer in PFC.`);
      router.refresh();
    });
  }

  function handleAddStep() {
    if (!newStepName.trim()) return;
    startTransition(async () => {
      await addProcessStep(ppapElementId, newStepName.trim());
      setNewStepName("");
      setShowAddStep(false);
      router.refresh();
    });
  }

  function handleDeleteStep(stepId: string) {
    startTransition(async () => {
      try {
        await deleteProcessStep(stepId, ppapElementId);
        router.refresh();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Could not delete step.");
      }
    });
  }

  function handleSendReminders() {
    startTransition(async () => {
      const result = await sendActionReminders(ppapElementId);
      setMessage(
        `Sent ${result.emailsSent} reminder email(s).${result.recipientsSkippedNoEmail > 0 ? ` ${result.recipientsSkippedNoEmail} open action(s) have no registered responsible person to email.` : ""}`,
      );
    });
  }

  const filteredStepRows = useMemo(() => {
    return steps.map((step) => ({
      step,
      rows: step.rows.filter((r) => rowMatchesFilters(r, filters)),
    }));
  }, [steps, filters]);

  const tableMeta: Meta = {
    getField,
    setField,
    commitRow,
    deleteRow,
    openSaveTemplate: setTemplatePanelRowId,
    locked,
    savingRowId,
    isPending,
    users,
  };

  const table = useReactTable({
    data: steps.flatMap((s) => s.rows),
    columns: COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.id,
    meta: tableMeta,
  });

  const rowById = new Map(table.getRowModel().rows.map((r) => [r.id, r]));
  const columnCount = table.getFlatHeaders().length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 rounded-md border p-2 text-xs">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={filters.highApOnly} onChange={(e) => setFilters((f) => ({ ...f, highApOnly: e.target.checked }))} />
          High AP only
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={filters.openOnly} onChange={(e) => setFilters((f) => ({ ...f, openOnly: e.target.checked }))} />
          Open actions only
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={filters.overdueOnly} onChange={(e) => setFilters((f) => ({ ...f, overdueOnly: e.target.checked }))} />
          Overdue only
        </label>
        <div className="ml-auto flex items-center gap-2">
          {!locked ? (
            <Button type="button" size="sm" variant="outline" onClick={handleSync} disabled={isPending}>
              Sync from PFC
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" onClick={handleSendReminders} disabled={isPending}>
            Send Reminders
          </Button>
        </div>
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
          {filteredStepRows.map(({ step, rows }) => (
            <tbody key={step.id}>
              <tr className="bg-muted/20">
                <td colSpan={columnCount} className="p-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold">{step.name}</span>
                    {step.removedFromSource ? <Badge variant="destructive">No longer in PFC</Badge> : null}
                    {!locked ? (
                      <>
                        <Button type="button" variant="ghost" size="sm" onClick={() => addRow(step.id)} disabled={isPending}>
                          + Add failure mode
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setLibraryPanelStepId(libraryPanelStepId === step.id ? null : step.id)}
                        >
                          Insert from library
                        </Button>
                        {step.rows.length === 0 ? (
                          <Button type="button" variant="ghost" size="sm" onClick={() => handleDeleteStep(step.id)} disabled={isPending}>
                            Delete step
                          </Button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                  {libraryPanelStepId === step.id ? (
                    <div className="mt-2">
                      <LibraryInsertPanel
                        ppapElementId={ppapElementId}
                        pfmeaProcessStepId={step.id}
                        operations={operations}
                        onDone={() => setLibraryPanelStepId(null)}
                      />
                    </div>
                  ) : null}
                </td>
              </tr>
              {rows.map((rowData) => {
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
                    {templatePanelRowId === row.id ? (
                      <tr>
                        <td colSpan={columnCount} className="p-1.5">
                          <SaveTemplatePanel rowId={row.id} operations={operations} onDone={() => setTemplatePanelRowId(null)} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
              {step.rows.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="p-2 text-center text-muted-foreground">
                    No failure modes yet for this step.
                  </td>
                </tr>
              ) : null}
            </tbody>
          ))}
          {steps.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={columnCount} className="p-4 text-center text-muted-foreground">
                  No process steps yet. Use &quot;Sync from PFC&quot; or add one manually below.
                </td>
              </tr>
            </tbody>
          ) : null}
        </table>
      </div>

      {!locked ? (
        showAddStep ? (
          <div className="flex items-center gap-2">
            <Input value={newStepName} onChange={(e) => setNewStepName(e.target.value)} placeholder="Step name" className="h-8 w-64 text-xs" />
            <Button type="button" size="sm" disabled={!newStepName.trim() || isPending} onClick={handleAddStep}>
              Add step
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowAddStep(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={() => setShowAddStep(true)}>
            Add process step manually
          </Button>
        )
      ) : null}
    </div>
  );
}
