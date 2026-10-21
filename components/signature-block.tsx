"use client";

import { useState, useTransition } from "react";
import { updateElementSignatures, reviseElement } from "@/lib/actions/workflow";
import { AddPersonForm } from "@/components/add-person-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Stage = "PREPARED" | "CHECKED" | "APPROVED";

type SignatureInfo = { byId: string | null; at: Date | null };

const ADD_NEW_SENTINEL = "__add_new__";

function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function SignatureBlock({
  ppapElementId,
  stages,
  status,
  users,
  prepared,
  checked,
  approved,
  labels,
}: {
  ppapElementId: string;
  stages: Stage[];
  status: string;
  users: { id: string; name: string }[];
  prepared: SignatureInfo;
  checked?: SignatureInfo;
  approved: SignatureInfo;
  /** Sheet-specific wording, e.g. AAR's "Prepared (Supplier QA)" / "Reviewed". Defaults to "Prepared by" etc. */
  labels?: Partial<Record<Stage, string>>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [revising, setRevising] = useState(false);
  const [reviseReason, setReviseReason] = useState("");
  const [localUsers, setLocalUsers] = useState(users);
  const [addingForStage, setAddingForStage] = useState<Stage | null>(null);

  const [preparedById, setPreparedById] = useState(prepared.byId ?? "");
  const [preparedAt, setPreparedAt] = useState(toDateInputValue(prepared.at));
  const [checkedById, setCheckedById] = useState(checked?.byId ?? "");
  const [checkedAt, setCheckedAt] = useState(toDateInputValue(checked?.at ?? null));
  const [approvedById, setApprovedById] = useState(approved.byId ?? "");
  const [approvedAt, setApprovedAt] = useState(toDateInputValue(approved.at));

  const locked = status === "APPROVED";
  const gridColsClass = stages.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3";

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await updateElementSignatures(ppapElementId, {
          preparedById: preparedById || null,
          preparedAt: preparedAt || null,
          checkedById: checkedById || null,
          checkedAt: checkedAt || null,
          approvedById: approvedById || null,
          approvedAt: approvedAt || null,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save signatures.");
      }
    });
  }

  const fieldsByStage: Record<
    Stage,
    { byId: string; setById: (v: string) => void; at: string; setAt: (v: string) => void }
  > = {
    PREPARED: { byId: preparedById, setById: setPreparedById, at: preparedAt, setAt: setPreparedAt },
    CHECKED: { byId: checkedById, setById: setCheckedById, at: checkedAt, setAt: setCheckedAt },
    APPROVED: { byId: approvedById, setById: setApprovedById, at: approvedAt, setAt: setApprovedAt },
  };

  const userName = (id: string | null) => localUsers.find((u) => u.id === id)?.name ?? null;

  function handleUserCreated(stage: Stage, user: { id: string; name: string }) {
    setLocalUsers((prev) => [...prev, user].sort((a, b) => a.name.localeCompare(b.name)));
    fieldsByStage[stage].setById(user.id);
    setAddingForStage(null);
  }

  return (
    <div className="mt-6 border-t pt-4">
      <div className={`grid gap-4 ${gridColsClass}`}>
        {stages.map((stage) => {
          const label = labels?.[stage] ?? `${stage.charAt(0) + stage.slice(1).toLowerCase()} by`;
          const field = fieldsByStage[stage];

          if (locked) {
            return (
              <div key={stage} className="space-y-1 text-sm">
                <div className="text-muted-foreground">{label}</div>
                <div className="font-medium">{userName(field.byId) ?? "—"}</div>
                <div className="text-muted-foreground">{field.at}</div>
              </div>
            );
          }

          if (addingForStage === stage) {
            return (
              <div key={stage} className="space-y-2 text-sm">
                <Label className="text-muted-foreground">{label}</Label>
                <AddPersonForm compact onCreated={(user) => handleUserCreated(stage, user)} />
                <Button type="button" variant="ghost" size="sm" onClick={() => setAddingForStage(null)}>
                  Cancel
                </Button>
              </div>
            );
          }

          return (
            <div key={stage} className="space-y-2 text-sm">
              <Label htmlFor={`sig-${stage}-by`} className="text-muted-foreground">
                {label}
              </Label>
              <select
                id={`sig-${stage}-by`}
                value={field.byId}
                onChange={(e) => {
                  if (e.target.value === ADD_NEW_SENTINEL) {
                    setAddingForStage(stage);
                    return;
                  }
                  field.setById(e.target.value);
                }}
                className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
              >
                <option value="">— Not set —</option>
                {localUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
                <option value={ADD_NEW_SENTINEL}>+ Add new person...</option>
              </select>
              <Input
                id={`sig-${stage}-at`}
                type="date"
                value={field.at}
                onChange={(e) => field.setAt(e.target.value)}
                disabled={!field.byId}
              />
            </div>
          );
        })}
      </div>

      {locked ? (
        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            This page is approved and locked for editing.
          </span>
          {!revising ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setRevising(true)}>
              Revise
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Label htmlFor="revise-reason" className="sr-only">
                Reason
              </Label>
              <Input
                id="revise-reason"
                placeholder="Reason for revision"
                value={reviseReason}
                onChange={(e) => setReviseReason(e.target.value)}
                className="w-64"
              />
              <Button
                type="button"
                size="sm"
                disabled={!reviseReason || isPending}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    try {
                      await reviseElement(ppapElementId, reviseReason);
                      setRevising(false);
                      setReviseReason("");
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Could not revise.");
                    }
                  });
                }}
              >
                Confirm
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setRevising(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      ) : (
        <Button type="button" size="sm" className="mt-4" disabled={isPending} onClick={save}>
          {isPending ? "Saving..." : "Save signatures"}
        </Button>
      )}
      {error ? <p className="mt-2 text-sm text-destructive" data-testid="signature-error">{error}</p> : null}
    </div>
  );
}
