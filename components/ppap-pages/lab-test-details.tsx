"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertLabTestDetail, deleteLabTestDetail } from "@/lib/actions/lab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Prisma } from "@/app/generated/prisma/client";

type Row = Prisma.LabTestDetailGetPayload<object>;
type Field = "testName" | "acceptanceCriteria" | "methodEquipment" | "standard";

export function LabTestDetails({ ppapElementId, reportId, locked, rows }: { ppapElementId: string; reportId: string; locked: boolean; rows: Row[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, Partial<Record<Field, string>>>>({});

  function getField(row: Row, field: Field): string {
    const draft = drafts[row.id]?.[field];
    if (draft !== undefined) return draft;
    return row[field] ?? "";
  }

  function setField(rowId: string, field: Field, value: string) {
    setDrafts((d) => ({ ...d, [rowId]: { ...d[rowId], [field]: value } }));
  }

  function commit(row: Row) {
    startTransition(async () => {
      await upsertLabTestDetail(ppapElementId, reportId, {
        id: row.id,
        testName: getField(row, "testName"),
        acceptanceCriteria: getField(row, "acceptanceCriteria"),
        methodEquipment: getField(row, "methodEquipment"),
        standard: getField(row, "standard"),
      });
      router.refresh();
    });
  }

  function addRow() {
    startTransition(async () => {
      await upsertLabTestDetail(ppapElementId, reportId, { testName: "New Test" });
      router.refresh();
    });
  }

  function deleteRow(rowId: string) {
    startTransition(async () => {
      await deleteLabTestDetail(rowId, ppapElementId);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/50">
              <th className="border-b p-1.5 text-left font-semibold">Test</th>
              <th className="border-b p-1.5 text-left font-semibold">Acceptance Criteria</th>
              <th className="border-b p-1.5 text-left font-semibold">Method/Equipment</th>
              <th className="border-b p-1.5 text-left font-semibold">Standard</th>
              <th className="border-b p-1.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b align-top">
                <td className="p-1.5">
                  <Input
                    aria-label="Test Name"
                    value={getField(row, "testName")}
                    disabled={locked}
                    onChange={(e) => setField(row.id, "testName", e.target.value)}
                    onBlur={() => commit(row)}
                    className="h-8 w-32 text-xs"
                  />
                </td>
                <td className="p-1.5">
                  <Input
                    aria-label="Acceptance Criteria"
                    value={getField(row, "acceptanceCriteria")}
                    disabled={locked}
                    onChange={(e) => setField(row.id, "acceptanceCriteria", e.target.value)}
                    onBlur={() => commit(row)}
                    className="h-8 w-40 text-xs"
                  />
                </td>
                <td className="p-1.5">
                  <Input
                    aria-label="Method/Equipment"
                    value={getField(row, "methodEquipment")}
                    disabled={locked}
                    onChange={(e) => setField(row.id, "methodEquipment", e.target.value)}
                    onBlur={() => commit(row)}
                    className="h-8 w-32 text-xs"
                  />
                </td>
                <td className="p-1.5">
                  <Input
                    aria-label="Standard"
                    value={getField(row, "standard")}
                    disabled={locked}
                    onChange={(e) => setField(row.id, "standard", e.target.value)}
                    onBlur={() => commit(row)}
                    className="h-8 w-28 text-xs"
                  />
                </td>
                <td className="p-1.5">
                  {!locked ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => deleteRow(row.id)}>
                      Delete
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!locked ? (
        <Button type="button" size="sm" variant="outline" onClick={addRow} disabled={isPending}>
          + Add Test
        </Button>
      ) : null}
    </div>
  );
}
