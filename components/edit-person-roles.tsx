"use client";

import { useState, useTransition } from "react";
import { updatePersonRolesAndCustomer } from "@/lib/actions/users";
import { Button } from "@/components/ui/button";

const USER_ROLES = ["ADMIN", "QA_ENGINEER", "QA_MANAGER", "ENGINEERING", "LEAD", "PRODUCTION", "CUSTOMER_APPROVER"] as const;

export function EditPersonRoles({
  userId,
  initialRoles,
  initialCustomerId,
  customers,
}: {
  userId: string;
  initialRoles: string[];
  initialCustomerId: string | null;
  customers: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!editing) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
        Edit
      </Button>
    );
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await updatePersonRolesAndCustomer(userId, formData);
      setEditing(false);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-2 text-sm">
      <div className="flex flex-wrap gap-2">
        {USER_ROLES.map((role) => (
          <label key={role} className="flex items-center gap-1">
            <input type="checkbox" name="roles" value={role} defaultChecked={initialRoles.includes(role)} />
            {role.replace(/_/g, " ")}
          </label>
        ))}
      </div>
      <select
        name="customerId"
        defaultValue={initialCustomerId ?? ""}
        className="h-8 rounded-md border bg-transparent px-2 text-sm"
      >
        <option value="">— None —</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving..." : "Save"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
