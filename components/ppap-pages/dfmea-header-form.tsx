"use client";

import { useTransition } from "react";
import { saveDfmeaHeader } from "@/lib/actions/dfmea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export function DfmeaHeaderForm({
  ppapElementId,
  locked,
  master,
  detail,
  users,
}: {
  ppapElementId: string;
  locked: boolean;
  master: {
    customerName: string;
    supplierName: string;
    partName: string;
    partNumber: string;
    project: string;
  };
  detail: {
    dfmeaRef: string | null;
    startDate: Date | null;
    revision: string | null;
    teamMemberIds: string[];
    designResponsibility: string | null;
  } | null;
  users: { id: string; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await saveDfmeaHeader(ppapElementId, formData);
    });
  }

  return (
    <form action={handleSubmit} className="mb-4 space-y-4 rounded-md border p-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Customer</Label>
          <Input value={master.customerName} disabled readOnly />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Project</Label>
          <Input value={master.project} disabled readOnly />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Part</Label>
          <Input value={master.partName} disabled readOnly />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Part No.</Label>
          <Input value={master.partNumber} disabled readOnly />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dfmeaRef" className="text-xs text-muted-foreground">
            DFMEA Ref.
          </Label>
          <Input id="dfmeaRef" name="dfmeaRef" defaultValue={detail?.dfmeaRef ?? ""} disabled={locked} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="startDate" className="text-xs text-muted-foreground">
            Start Date
          </Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={toDateInputValue(detail?.startDate)}
            disabled={locked}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="revision" className="text-xs text-muted-foreground">
            Revision
          </Label>
          <Input id="revision" name="revision" defaultValue={detail?.revision ?? ""} disabled={locked} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="designResponsibility" className="text-xs text-muted-foreground">
            Design Responsibility
          </Label>
          <Input
            id="designResponsibility"
            name="designResponsibility"
            defaultValue={detail?.designResponsibility ?? ""}
            disabled={locked}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Team Members</Label>
        <div className="flex flex-wrap gap-3">
          {users.map((u) => (
            <label key={u.id} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                name="teamMemberIds"
                value={u.id}
                defaultChecked={detail?.teamMemberIds.includes(u.id) ?? false}
                disabled={locked}
              />
              {u.name}
            </label>
          ))}
        </div>
      </div>

      {!locked ? (
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving..." : "Save header"}
        </Button>
      ) : null}
    </form>
  );
}
