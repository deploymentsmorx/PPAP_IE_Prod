"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { saveChecklist } from "@/lib/actions/checklist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ChecklistRowData = {
  elementNo: number;
  name: string;
  docNo: string | null;
  requiredOverride: string;
  statusOverride: string;
  remarks: string;
  docRefLabel: string;
};

export function ChecklistForm({
  ppapId,
  locked,
  rows,
}: {
  ppapId: string;
  locked: boolean;
  rows: ChecklistRowData[];
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const { skippedLocked, synced } = await saveChecklist(ppapId, formData);
      const parts: string[] = [];
      if (synced.length) parts.push(`Applicability updated on page(s) ${synced.join(", ")}.`);
      if (skippedLocked.length) {
        parts.push(`Page(s) ${skippedLocked.join(", ")} are approved and locked — revise them to change applicability.`);
      }
      setMessage(parts.length ? parts.join(" ") : null);
    });
  }

  return (
    <form ref={formRef} action={handleSubmit}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">Sl.</TableHead>
            <TableHead>PPAP Element</TableHead>
            <TableHead className="w-24">Required</TableHead>
            <TableHead className="w-28">Status</TableHead>
            <TableHead>Remarks</TableHead>
            <TableHead className="w-40">Document Reference</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.elementNo}>
              <TableCell className="text-muted-foreground">{row.elementNo}</TableCell>
              <TableCell>
                <Link href={`/ppap/${ppapId}/${row.elementNo}`} className="hover:underline">
                  {row.name}
                </Link>
              </TableCell>
              <TableCell>
                <Input
                  name={`required-${row.elementNo}`}
                  defaultValue={row.requiredOverride}
                  disabled={locked}
                  placeholder="Y / N"
                />
              </TableCell>
              <TableCell>
                <Input
                  name={`status-${row.elementNo}`}
                  defaultValue={row.statusOverride}
                  disabled={locked}
                  placeholder="OK / NG / Pending"
                />
              </TableCell>
              <TableCell>
                <Input
                  name={`remarks-${row.elementNo}`}
                  defaultValue={row.remarks}
                  disabled={locked}
                  placeholder="Remarks"
                />
              </TableCell>
              <TableCell>
                <Input
                  name={`docref-${row.elementNo}`}
                  defaultValue={row.docRefLabel}
                  disabled={locked}
                  placeholder={row.docNo ?? "Doc reference"}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!locked ? (
        <Button type="submit" size="sm" className="mt-3" disabled={isPending}>
          {isPending ? "Saving..." : "Save"}
        </Button>
      ) : null}
      {message ? <p className="mt-2 text-sm text-muted-foreground">{message}</p> : null}
      <p className="mt-2 text-xs text-muted-foreground">
        Required = Y / N stays in sync with each page&apos;s N/A setting.
      </p>
    </form>
  );
}
