"use client";

import { AddPersonForm } from "@/components/add-person-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ADD_NEW_SENTINEL = "__add_new__";

/**
 * A single "X by / date" picker with inline "+ Add new person" quick-add.
 * Shared by any form that needs a one-off named signer outside the main
 * page-level SignatureBlock (e.g. ECN's Prepared/Reviewed/Approved,
 * CEA's supplier declaration).
 */
export function SignerField({
  label,
  idPrefix,
  users,
  byId,
  setById,
  at,
  setAt,
  adding,
  setAdding,
  onUserCreated,
  disabled,
}: {
  label: string;
  idPrefix: string;
  users: { id: string; name: string }[];
  byId: string;
  setById: (v: string) => void;
  at: string;
  setAt: (v: string) => void;
  adding: boolean;
  setAdding: (v: boolean) => void;
  onUserCreated: (user: { id: string; name: string }) => void;
  disabled: boolean;
}) {
  if (adding) {
    return (
      <div className="space-y-2 text-sm">
        <Label className="text-muted-foreground">{label}</Label>
        <AddPersonForm compact onCreated={onUserCreated} />
        <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      <Label htmlFor={`${idPrefix}-by`} className="text-muted-foreground">
        {label}
      </Label>
      <select
        id={`${idPrefix}-by`}
        value={byId}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value === ADD_NEW_SENTINEL) {
            setAdding(true);
            return;
          }
          setById(e.target.value);
        }}
        className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
      >
        <option value="">— Not set —</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
        <option value={ADD_NEW_SENTINEL}>+ Add new person...</option>
      </select>
      <Input
        id={`${idPrefix}-at`}
        type="date"
        value={at}
        disabled={disabled || !byId}
        onChange={(e) => setAt(e.target.value)}
      />
    </div>
  );
}
