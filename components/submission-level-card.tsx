"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSubmissionLevel } from "@/lib/actions/submission-level";
import { SUBMISSION_LEVELS, SUPPORTING_ELEMENT_NOS, submissionElementNos, submissionLevel } from "@/lib/calc/submission-level";
import { PPAP_ELEMENT_NAMES } from "@/lib/constants/ppap-elements";
import { submitFormData } from "@/lib/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const btn = "inline-flex h-9 items-center rounded-md border bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90";

/**
 * Final PPAP submission (pack page): pick the AIAG level — and, for levels
 * 2 / 4, the supporting documents — then download one PDF with the PSW as
 * sheet 1 followed by that level's sheets. The download appears once the
 * on-screen choice is saved.
 */
export function SubmissionLevelCard({
  ppapId,
  savedLevel,
  savedPicks,
  confirmed,
  applicable,
  editable,
  lockedReason,
}: {
  ppapId: string;
  savedLevel: number;
  savedPicks: number[];
  confirmed: boolean;
  /** Element numbers that are not N/A (the checklist cover always is). */
  applicable: number[];
  editable: boolean;
  lockedReason: string | null;
}) {
  const [level, setLevel] = useState(savedLevel);
  const [picks, setPicks] = useState<number[]>(savedPicks.filter((n) => applicable.includes(n)));
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const def = submissionLevel(level)!;
  const applicableSet = new Set(applicable);
  const order = submissionElementNos(level, picks, applicableSet);
  const savedOrder = submissionElementNos(savedLevel, savedPicks, applicableSet);
  const dirty = level !== savedLevel || (def.picks && order.join() !== savedOrder.join());
  const ready = confirmed && !dirty;

  function save() {
    setMessage(null);
    startTransition(async () => {
      try {
        await setSubmissionLevel(ppapId, { level, elementNos: def.picks ? picks : [] });
        router.refresh();
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  const toggle = (n: number) => setPicks((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));

  return (
    <Card data-testid="submission-level">
      <CardHeader>
        <CardTitle>Final PPAP — submission level</CardTitle>
        <p className="text-sm text-muted-foreground">
          Choose the level the customer requested. The final PDF has the PSW as sheet 1, followed by that level&apos;s documents in element order
          (N/A elements are left out). The level is also ticked on the PSW.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submitFormData(save)} className="space-y-4">
          <fieldset className="space-y-2" disabled={!editable || isPending}>
            <legend className="sr-only">Submission level</legend>
            {SUBMISSION_LEVELS.map((l) => (
              <label
                key={l.level}
                className={cn("flex cursor-pointer gap-3 rounded-md border p-3 text-sm hover:bg-muted", level === l.level && "border-primary bg-muted")}
              >
                <input type="radio" name="level" value={l.level} checked={level === l.level} onChange={() => setLevel(l.level)} className="mt-1" />
                <span>
                  <span className="font-semibold">Level {l.level}:</span> {l.title}
                  <span className="block text-muted-foreground">{l.description}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {def.picks ? (
            <fieldset className="space-y-2 rounded-md border p-3" disabled={!editable || isPending} data-testid="submission-picks">
              <legend className="px-1 text-sm font-semibold">Supporting documents to include with the PSW</legend>
              <div className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                {SUPPORTING_ELEMENT_NOS.map((n) => {
                  const na = !applicableSet.has(n);
                  return (
                    <label key={n} className={cn("flex items-center gap-2", na && "text-muted-foreground")}>
                      <input type="checkbox" checked={!na && picks.includes(n)} disabled={na} onChange={() => toggle(n)} />
                      {n}. {PPAP_ELEMENT_NAMES[n]}
                      {na ? <span className="text-xs">(N/A)</span> : null}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          <div className="rounded-md bg-muted p-3 text-sm">
            <div className="font-semibold">Final PDF — {order.length} sheet(s), in this order</div>
            <ol className="mt-1 list-decimal pl-5" data-testid="submission-order">
              {order.map((n) => (
                <li key={n}>
                  {n}. {PPAP_ELEMENT_NAMES[n]}
                </li>
              ))}
            </ol>
            {def.productSample ? <p className="mt-2 text-muted-foreground">Send product samples with this submission.</p> : null}
            {level === 5 ? <p className="text-muted-foreground">The submission is reviewed at the supplier&apos;s manufacturing location.</p> : null}
          </div>

          {lockedReason ? <p className="text-sm text-muted-foreground">{lockedReason}</p> : null}
          {message ? <p className="text-sm text-destructive">{message}</p> : null}

          <div className="flex flex-wrap items-center gap-2">
            {editable ? (
              <Button type="submit" variant={ready ? "outline" : "default"} disabled={isPending || ready}>
                {isPending ? "Saving..." : ready ? `Level ${savedLevel} confirmed` : `Confirm Level ${level}`}
              </Button>
            ) : null}
            {ready ? (
              <a className={btn} href={`/api/ppap/${ppapId}/pack?format=pdf&set=final`} data-testid="final-pdf" download>
                Download final PPAP (Level {savedLevel}) PDF
              </a>
            ) : null}
            {ready ? <span className="text-xs text-muted-foreground">Rendering takes a minute or two.</span> : null}
            {!ready && !editable && !confirmed ? <span className="text-sm text-muted-foreground">The supplier hasn&apos;t confirmed a submission level yet.</span> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
