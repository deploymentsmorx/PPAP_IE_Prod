"use client";

import { useMemo, useState } from "react";
import { createPpap } from "@/lib/actions/ppap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Prisma } from "@/app/generated/prisma/client";

type Customer = Prisma.CustomerGetPayload<{
  select: { id: true; name: true; approvalMode: true; defaultPpapLevel: true };
}>;
type Part = Prisma.PartGetPayload<{
  select: { id: true; partName: true; partNumber: true; customerId: true };
}>;
type PartRevision = Prisma.PartRevisionGetPayload<{
  select: { id: true; partId: true; revision: true };
}>;
type MaterialSpec = Prisma.MaterialSpecGetPayload<{ select: { id: true; standard: true; grade: true } }>;

export function NewPpapForm({
  customers,
  parts,
  partRevisions,
  materialSpecs,
}: {
  customers: Customer[];
  parts: Part[];
  partRevisions: PartRevision[];
  materialSpecs: MaterialSpec[];
}) {
  const [customerMode, setCustomerMode] = useState<"existing" | "new">(customers.length ? "existing" : "new");
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");

  const [partMode, setPartMode] = useState<"existing" | "new">("new");
  const [partId, setPartId] = useState("");

  const [revisionMode, setRevisionMode] = useState<"existing" | "new">("new");
  const [partRevisionId, setPartRevisionId] = useState("");

  const partsForCustomer = useMemo(
    () => parts.filter((p) => p.customerId === customerId),
    [parts, customerId],
  );
  const revisionsForPart = useMemo(
    () => partRevisions.filter((r) => r.partId === partId),
    [partRevisions, partId],
  );

  const selectedCustomer = customers.find((c) => c.id === customerId);

  return (
    <form action={createPpap} className="space-y-6">
      <h1 className="text-lg font-semibold">New PPAP</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Customer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="customerMode"
                value="existing"
                checked={customerMode === "existing"}
                onChange={() => setCustomerMode("existing")}
                disabled={customers.length === 0}
              />
              Existing
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="customerMode"
                value="new"
                checked={customerMode === "new"}
                onChange={() => setCustomerMode("new")}
              />
              New customer
            </label>
          </div>
          {customerMode === "existing" ? (
            <select
              name="customerId"
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                setPartMode("new");
                setPartId("");
                setRevisionMode("new");
                setPartRevisionId("");
              }}
              className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="space-y-1">
              <Label htmlFor="newCustomerName">Customer name</Label>
              <Input id="newCustomerName" name="newCustomerName" required />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Part</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="partMode"
                value="existing"
                checked={partMode === "existing"}
                onChange={() => setPartMode("existing")}
                disabled={partsForCustomer.length === 0}
              />
              Existing
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="partMode"
                value="new"
                checked={partMode === "new"}
                onChange={() => setPartMode("new")}
              />
              New part
            </label>
          </div>
          {partMode === "existing" ? (
            <select
              name="partId"
              value={partId}
              onChange={(e) => {
                setPartId(e.target.value);
                setRevisionMode("new");
                setPartRevisionId("");
              }}
              className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
            >
              <option value="">— Select —</option>
              {partsForCustomer.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.partName} ({p.partNumber})
                </option>
              ))}
            </select>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="newPartName">Part name</Label>
                <Input id="newPartName" name="newPartName" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="newPartNumber">Part number</Label>
                <Input id="newPartNumber" name="newPartNumber" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="newProjectModel">Project/model</Label>
                <Input id="newProjectModel" name="newProjectModel" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="newMaterialSpecId">Material spec</Label>
                <select
                  id="newMaterialSpecId"
                  name="newMaterialSpecId"
                  defaultValue=""
                  className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
                >
                  <option value="">— Select —</option>
                  {materialSpecs.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.standard} {m.grade}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Part Revision</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="revisionMode"
                value="existing"
                checked={revisionMode === "existing"}
                onChange={() => setRevisionMode("existing")}
                disabled={revisionsForPart.length === 0}
              />
              Existing
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="revisionMode"
                value="new"
                checked={revisionMode === "new"}
                onChange={() => setRevisionMode("new")}
              />
              New revision
            </label>
          </div>
          {revisionMode === "existing" ? (
            <select
              name="partRevisionId"
              value={partRevisionId}
              onChange={(e) => setPartRevisionId(e.target.value)}
              className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
            >
              <option value="">— Select —</option>
              {revisionsForPart.map((r) => (
                <option key={r.id} value={r.id}>
                  Rev. {r.revision}
                </option>
              ))}
            </select>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="newRevision">Revision letter</Label>
                <Input id="newRevision" name="newRevision" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="newDrawingNo">Drawing number</Label>
                <Input id="newDrawingNo" name="newDrawingNo" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">PPAP Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="level">Level</Label>
            <select
              id="level"
              name="level"
              defaultValue={String(selectedCustomer?.defaultPpapLevel ?? 3)}
              className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
            >
              {[1, 2, 3, 4, 5].map((l) => (
                <option key={l} value={l}>
                  Level {l}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="approvalMode">Approval mode</Label>
            <select
              id="approvalMode"
              name="approvalMode"
              defaultValue={selectedCustomer?.approvalMode ?? "SUPPLIER_UPLOAD"}
              className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
            >
              <option value="SUPPLIER_UPLOAD">Supplier uploads signed copy</option>
              <option value="CUSTOMER_PORTAL">Customer portal (login)</option>
            </select>
          </div>
          <div className="col-span-2 space-y-1">
            <Label htmlFor="reasonForSubmission">Reason for submission</Label>
            <Input id="reasonForSubmission" name="reasonForSubmission" placeholder="e.g. Initial Submission" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="submissionDate">Submission date</Label>
            <Input
              id="submissionDate"
              name="submissionDate"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </div>
        </CardContent>
      </Card>

      <Button type="submit">Create PPAP</Button>
    </form>
  );
}
