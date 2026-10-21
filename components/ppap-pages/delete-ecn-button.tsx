"use client";

import { useTransition } from "react";
import { deleteEcn } from "@/lib/actions/ecn";
import { Button } from "@/components/ui/button";

export function DeleteEcnButton({ ecnId, ppapElementId }: { ecnId: string; ppapElementId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => startTransition(async () => { await deleteEcn(ecnId, ppapElementId); })}
    >
      Delete
    </Button>
  );
}
