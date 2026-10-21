"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  createChildPart,
  deleteChildPart,
  moveChildPart,
  addRouteStep,
  removeRouteStep,
  moveRouteStep,
  updateRouteStepDetails,
} from "@/lib/actions/pfc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Operation = { id: string; name: string; symbol: string };
type RouteStep = { id: string; sequence: number; machine: string | null; note: string | null; operation: Operation };
type ChildPart = {
  id: string;
  itemNo: number;
  partNo: string;
  description: string;
  qtyPerAssembly: number;
  side: "LEFT" | "RIGHT";
  type: "MAKE" | "BOP";
  sketchImageUrl: string | null;
  parentChildPartId: string | null;
  route: { id: string; steps: RouteStep[] } | null;
};

const SYMBOL_LABEL: Record<string, string> = {
  OPERATION: "○",
  INSPECTION: "□",
  STORAGE: "▽",
  TRANSPORT: "→",
  DELAY: "D",
};

function StepChip({
  step,
  locked,
  ppapElementId,
  isFirst,
  isLast,
}: {
  step: RouteStep;
  locked: boolean;
  ppapElementId: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [machine, setMachine] = useState(step.machine ?? "");
  const [note, setNote] = useState(step.note ?? "");

  function saveDetails() {
    startTransition(async () => {
      await updateRouteStepDetails(ppapElementId, step.id, { machine, note });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1 rounded-md border bg-muted/30 px-2 py-1 text-xs">
      <div className="flex items-center gap-1">
        <span className="font-mono" title={step.operation.symbol}>
          {SYMBOL_LABEL[step.operation.symbol] ?? "?"}
        </span>
        <span>{step.operation.name}</span>
        {!locked ? (
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={isPending || isFirst}
              onClick={() =>
                startTransition(async () => {
                  await moveRouteStep(ppapElementId, step.id, "up");
                  router.refresh();
                })
              }
            >
              ↑
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={isPending || isLast}
              onClick={() =>
                startTransition(async () => {
                  await moveRouteStep(ppapElementId, step.id, "down");
                  router.refresh();
                })
              }
            >
              ↓
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await removeRouteStep(ppapElementId, step.id);
                  router.refresh();
                })
              }
            >
              ×
            </Button>
          </div>
        ) : null}
      </div>
      {!locked ? (
        <div className="flex gap-1">
          <Input
            value={machine}
            onChange={(e) => setMachine(e.target.value)}
            onBlur={saveDetails}
            placeholder="Machine"
            className="h-6 w-20 text-[10px]"
          />
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={saveDetails}
            placeholder="Note"
            className="h-6 w-20 text-[10px]"
          />
        </div>
      ) : machine || note ? (
        <div className="text-[10px] text-muted-foreground">
          {machine} {note}
        </div>
      ) : null}
    </div>
  );
}

function RouteEditor({
  childPart,
  operations,
  locked,
  ppapElementId,
}: {
  childPart: ChildPart;
  operations: Operation[];
  locked: boolean;
  ppapElementId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [selectedOpId, setSelectedOpId] = useState("");
  const steps = childPart.route?.steps ?? [];

  function handleAdd() {
    if (!selectedOpId || !childPart.route) return;
    startTransition(async () => {
      await addRouteStep(ppapElementId, childPart.route!.id, selectedOpId);
      setSelectedOpId("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 rounded-md border bg-background p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {steps.map((step, i) => (
          <StepChip
            key={step.id}
            step={step}
            locked={locked}
            ppapElementId={ppapElementId}
            isFirst={i === 0}
            isLast={i === steps.length - 1}
          />
        ))}
        {steps.length === 0 ? <span className="text-xs text-muted-foreground">No route steps yet.</span> : null}
      </div>
      {!locked ? (
        <div className="flex items-end gap-2">
          <select
            value={selectedOpId}
            onChange={(e) => setSelectedOpId(e.target.value)}
            className="h-8 w-56 rounded-md border bg-transparent px-2 text-xs"
          >
            <option value="">— Add operation —</option>
            {operations.map((op) => (
              <option key={op.id} value={op.id}>
                {op.name}
              </option>
            ))}
          </select>
          <Button type="button" size="sm" disabled={!selectedOpId || isPending} onClick={handleAdd}>
            Add
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function AddChildPartForm({
  ppapElementId,
  childParts,
  onDone,
}: {
  ppapElementId: string;
  childParts: ChildPart[];
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [partNo, setPartNo] = useState("");
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState("1");
  const [side, setSide] = useState<"LEFT" | "RIGHT">("LEFT");
  const [type, setType] = useState<"MAKE" | "BOP">("MAKE");
  const [parentId, setParentId] = useState("");

  function handleSubmit() {
    startTransition(async () => {
      await createChildPart(ppapElementId, {
        partNo,
        description,
        qtyPerAssembly: qty,
        side,
        type,
        parentChildPartId: parentId,
      });
      router.refresh();
      onDone();
    });
  }

  return (
    <div className="grid grid-cols-2 gap-3 rounded-md border p-3 sm:grid-cols-6">
      <div className="space-y-1">
        <Label htmlFor="pfc-new-partno" className="text-xs">Part No.</Label>
        <Input id="pfc-new-partno" value={partNo} onChange={(e) => setPartNo(e.target.value)} className="h-8 text-xs" />
      </div>
      <div className="col-span-2 space-y-1">
        <Label htmlFor="pfc-new-description" className="text-xs">Description</Label>
        <Input id="pfc-new-description" value={description} onChange={(e) => setDescription(e.target.value)} className="h-8 text-xs" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="pfc-new-qty" className="text-xs">Qty/Str</Label>
        <Input id="pfc-new-qty" type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} className="h-8 text-xs" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="pfc-new-side" className="text-xs">Side</Label>
        <select id="pfc-new-side" value={side} onChange={(e) => setSide(e.target.value as "LEFT" | "RIGHT")} className="h-8 w-full rounded-md border bg-transparent px-1 text-xs">
          <option value="LEFT">Left</option>
          <option value="RIGHT">Right</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="pfc-new-type" className="text-xs">Type</Label>
        <select id="pfc-new-type" value={type} onChange={(e) => setType(e.target.value as "MAKE" | "BOP")} className="h-8 w-full rounded-md border bg-transparent px-1 text-xs">
          <option value="MAKE">Make</option>
          <option value="BOP">BOP</option>
        </select>
      </div>
      <div className="col-span-2 space-y-1">
        <Label htmlFor="pfc-new-parent" className="text-xs">Sub-assembly of (optional)</Label>
        <select
          id="pfc-new-parent"
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className="h-8 w-full rounded-md border bg-transparent px-1 text-xs"
        >
          <option value="">— None —</option>
          {childParts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.itemNo}. {c.partNo}
            </option>
          ))}
        </select>
      </div>
      <div className="col-span-2 flex items-end gap-2">
        <Button type="button" size="sm" disabled={!partNo || !description || isPending} onClick={handleSubmit}>
          {isPending ? "Adding..." : "Add child part"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function PfcChildPartsGrid({
  ppapElementId,
  locked,
  childParts,
  operations,
}: {
  ppapElementId: string;
  locked: boolean;
  childParts: ChildPart[];
  operations: Operation[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const partNoById = new Map(childParts.map((c) => [c.id, c.partNo]));

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/50">
              <th className="border-b p-1.5 text-left font-semibold">Item</th>
              <th className="border-b p-1.5 text-left font-semibold">Sketch</th>
              <th className="border-b p-1.5 text-left font-semibold">Part No.</th>
              <th className="border-b p-1.5 text-left font-semibold">Description</th>
              <th className="border-b p-1.5 text-left font-semibold">Qty/Str</th>
              <th className="border-b p-1.5 text-left font-semibold">Side</th>
              <th className="border-b p-1.5 text-left font-semibold">Type</th>
              <th className="border-b p-1.5 text-left font-semibold">Sub-assembly of</th>
              <th className="border-b p-1.5 text-left font-semibold">Route</th>
              <th className="border-b p-1.5 text-left font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {childParts.map((cp, i) => (
              <Fragment key={cp.id}>
                <tr className="border-b align-top">
                  <td className="p-1.5">{cp.itemNo}</td>
                  <td className="p-1.5">
                    {cp.sketchImageUrl ? (
                      <Image src={cp.sketchImageUrl} alt={cp.partNo} width={48} height={48} className="h-12 w-12 object-contain" unoptimized />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-1.5 font-medium">{cp.partNo}</td>
                  <td className="p-1.5">{cp.description}</td>
                  <td className="p-1.5">{cp.qtyPerAssembly}</td>
                  <td className="p-1.5">{cp.side}</td>
                  <td className="p-1.5">
                    <Badge variant={cp.type === "BOP" ? "secondary" : "outline"}>{cp.type}</Badge>
                  </td>
                  <td className="p-1.5">{cp.parentChildPartId ? partNoById.get(cp.parentChildPartId) : "—"}</td>
                  <td className="p-1.5">
                    <Button type="button" variant="outline" size="sm" onClick={() => setExpandedId(expandedId === cp.id ? null : cp.id)}>
                      {expandedId === cp.id ? "Hide" : `${cp.route?.steps.length ?? 0} steps`}
                    </Button>
                  </td>
                  <td className="p-1.5">
                    {!locked ? (
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={isPending || i === 0}
                          onClick={() => startTransition(async () => { await moveChildPart(cp.id, ppapElementId, "up"); router.refresh(); })}
                        >
                          ↑
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={isPending || i === childParts.length - 1}
                          onClick={() => startTransition(async () => { await moveChildPart(cp.id, ppapElementId, "down"); router.refresh(); })}
                        >
                          ↓
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => startTransition(async () => { await deleteChildPart(cp.id, ppapElementId); router.refresh(); })}
                        >
                          Delete
                        </Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
                {expandedId === cp.id ? (
                  <tr className="border-b bg-muted/10">
                    <td colSpan={10} className="p-2">
                      <RouteEditor childPart={cp} operations={operations} locked={locked} ppapElementId={ppapElementId} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
            {childParts.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-4 text-center text-muted-foreground">
                  No child parts yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {!locked ? (
        showAddForm ? (
          <AddChildPartForm ppapElementId={ppapElementId} childParts={childParts} onDone={() => setShowAddForm(false)} />
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={() => setShowAddForm(true)}>
            Add child part
          </Button>
        )
      ) : null}
    </div>
  );
}
