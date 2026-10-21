"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateApprovalMode } from "@/lib/actions/ppap-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ApprovalModeControl({ ppapId, initialMode }: { ppapId: string; initialMode: string }) {
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState(initialMode);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-muted-foreground underline decoration-dotted hover:text-foreground"
      >
        {mode === "CUSTOMER_PORTAL" ? "Customer portal" : "Supplier upload"}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value)}
        className="h-7 rounded-md border bg-transparent px-1 text-xs"
      >
        <option value="SUPPLIER_UPLOAD">Supplier upload</option>
        <option value="CUSTOMER_PORTAL">Customer portal</option>
      </select>
      <Input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for change"
        className="h-7 w-40 text-xs"
      />
      <Button
        type="button"
        size="sm"
        className="h-7"
        disabled={!reason || isPending}
        onClick={() =>
          startTransition(async () => {
            await updateApprovalMode(ppapId, mode as "SUPPLIER_UPLOAD" | "CUSTOMER_PORTAL", reason);
            setEditing(false);
            setReason("");
            router.refresh();
          })
        }
      >
        {isPending ? "Saving..." : "Save"}
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-7" onClick={() => setEditing(false)}>
        Cancel
      </Button>
    </span>
  );
}
