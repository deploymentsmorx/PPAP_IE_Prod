"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDueSoonDays, sendCalibrationDigestNow } from "@/lib/actions/instruments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitFormData } from "@/lib/form";

/** Due-soon window setting + "Send digest now" (the weekly email also runs on a schedule). */
export function CalibrationSettings({ dueSoonDays }: { dueSoonDays: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run(action: () => Promise<string>) {
    setMessage(null);
    startTransition(async () => {
      try {
        setMessage(await action());
        router.refresh();
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <form
        onSubmit={submitFormData((formData) =>
          run(async () => {
            await saveDueSoonDays(formData);
            return "Saved.";
          }),
        )}
        className="flex items-end gap-2"
      >
        <div className="space-y-1">
          <Label htmlFor="dueSoonDays">&ldquo;Due soon&rdquo; window (days)</Label>
          <Input id="dueSoonDays" name="dueSoonDays" type="number" min={0} max={365} defaultValue={dueSoonDays} className="w-28" />
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={isPending}>
          Save
        </Button>
      </form>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() =>
          run(async () => {
            const r = await sendCalibrationDigestNow();
            return r.subject ? `Sent "${r.subject}" to ${r.sent} QA user(s).` : "Nothing due or overdue — no email sent.";
          })
        }
      >
        Send due/overdue digest now
      </Button>
      {message ? <span className="text-sm text-muted-foreground">{message}</span> : null}
    </div>
  );
}
