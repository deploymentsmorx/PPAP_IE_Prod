"use client";

import { useRef, useState, useTransition } from "react";
import { createPerson } from "@/lib/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const USER_ROLES = ["ADMIN", "QA_ENGINEER", "QA_MANAGER", "ENGINEERING", "LEAD", "PRODUCTION", "CUSTOMER_APPROVER"] as const;

export function AddPersonForm({
  onCreated,
  compact = false,
  customers = [],
}: {
  onCreated?: (user: { id: string; name: string }) => void;
  compact?: boolean;
  customers?: { id: string; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        const user = await createPerson(formData);
        formRef.current?.reset();
        onCreated?.(user);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add person.");
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className={compact ? "space-y-2" : "space-y-3"}>
      <div className={compact ? "flex flex-wrap items-end gap-2" : "grid grid-cols-2 gap-3"}>
        <div className="space-y-1">
          {!compact ? <Label htmlFor="person-name">Name</Label> : null}
          <Input id="person-name" name="name" placeholder="Name" required className={compact ? "h-8 w-32" : undefined} />
        </div>
        <div className="space-y-1">
          {!compact ? <Label htmlFor="person-email">Email</Label> : null}
          <Input
            id="person-email"
            name="email"
            type="email"
            placeholder="Email"
            required
            className={compact ? "h-8 w-44" : undefined}
          />
        </div>
        {!compact ? (
          <>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="person-designation">Designation</Label>
              <Input id="person-designation" name="designation" placeholder="e.g. QA Engineer" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Roles</Label>
              <div className="flex flex-wrap gap-3 text-sm">
                {USER_ROLES.map((role) => (
                  <label key={role} className="flex items-center gap-1.5">
                    <input type="checkbox" name="roles" value={role} />
                    {role.replace(/_/g, " ")}
                  </label>
                ))}
              </div>
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="person-customer">
                Customer <span className="text-muted-foreground">(for Customer Approver)</span>
              </Label>
              <select
                id="person-customer"
                name="customerId"
                defaultValue=""
                className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
              >
                <option value="">— None —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Adding..." : "Add"}
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
