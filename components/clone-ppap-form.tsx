"use client";

import { useState, useTransition } from "react";
import { clonePpapAction } from "@/lib/actions/clone";
import { submitFormData } from "@/lib/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ClonePpapForm({
  ppapId,
  source,
  customers,
}: {
  ppapId: string;
  source: { customerId: string; partName: string; partNumber: string; approvalMode: string };
  customers: { id: string; name: string }[];
}) {
  const [mode, setMode] = useState<"revision" | "part">("revision");
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={submitFormData((fd) => {
        setError(null);
        startTransition(async () => {
          try {
            await clonePpapAction(ppapId, fd);
          } catch (err) {
            // redirect() also throws — let Next handle it.
            if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
            setError(err instanceof Error ? err.message : "Clone failed.");
          }
        });
      })}
      className="space-y-4"
    >
      <fieldset className="flex gap-4 text-sm">
        <legend className="mb-1 font-medium">Clone to</legend>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="mode" value="revision" checked={mode === "revision"} onChange={() => setMode("revision")} /> New revision of {source.partNumber}
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="mode" value="part" checked={mode === "part"} onChange={() => setMode("part")} /> A new part
        </label>
      </fieldset>

      {mode === "part" ? (
        <div className="space-y-3 rounded-md border p-3">
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="radio" name="customerMode" value="existing" checked={customerMode === "existing"} onChange={() => setCustomerMode("existing")} /> Existing customer
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="customerMode" value="new" checked={customerMode === "new"} onChange={() => setCustomerMode("new")} /> New customer
            </label>
          </div>
          {customerMode === "existing" ? (
            <select name="customerId" aria-label="Customer" defaultValue={source.customerId} className="h-9 w-full rounded-md border bg-transparent px-2 text-sm">
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="space-y-1">
              <Label htmlFor="clone-newCustomerName">New customer name</Label>
              <Input id="clone-newCustomerName" name="newCustomerName" required />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="clone-partName">Part name</Label>
              <Input id="clone-partName" name="partName" defaultValue={source.partName} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="clone-partNumber">Part number</Label>
              <Input id="clone-partNumber" name="partNumber" required />
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label htmlFor="clone-revision">Revision letter</Label>
          <Input id="clone-revision" name="revision" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="clone-drawingNo">Drawing number</Label>
          <Input id="clone-drawingNo" name="drawingNo" placeholder="Same as source" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="clone-approvalMode">Customer approval</Label>
          <select id="clone-approvalMode" name="approvalMode" defaultValue={source.approvalMode} className="h-9 w-full rounded-md border bg-transparent px-2 text-sm">
            <option value="SUPPLIER_UPLOAD">Supplier upload</option>
            <option value="CUSTOMER_PORTAL">Customer portal</option>
          </select>
        </div>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Cloning…" : "Clone PPAP"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
