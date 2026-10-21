"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveEcn, cloneToNewRevision } from "@/lib/actions/ecn";
import { SignerField } from "@/components/signer-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PPAP_ELEMENT_NUMBERS, PPAP_ELEMENT_NAMES } from "@/lib/constants/ppap-elements";
import type { Prisma } from "@/app/generated/prisma/client";

type Ecn = Prisma.EcnRecordGetPayload<object> | null;

const AFFECTED_ELEMENT_NUMBERS = PPAP_ELEMENT_NUMBERS.filter((n) => n >= 1 && n <= 18);

function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export function EcnDetailForm({
  ppapId,
  ppapElementId,
  ecn,
  locked,
  users,
  masterDefaults,
  newRevisionLabel,
}: {
  ppapId: string;
  ppapElementId: string;
  ecn: Ecn;
  locked: boolean;
  users: { id: string; name: string }[];
  masterDefaults: {
    partNameSnapshot: string;
    partNumberSnapshot: string;
    customerNameSnapshot: string;
    drawingNumberSnapshot: string;
    drawingRevisionSnapshot: string;
  } | null;
  newRevisionLabel: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCloning, startCloneTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);

  const [localUsers, setLocalUsers] = useState(users);
  const [preparedById, setPreparedById] = useState(ecn?.preparedById ?? "");
  const [preparedAt, setPreparedAt] = useState(toDateInputValue(ecn?.preparedAt));
  const [addingPrepared, setAddingPrepared] = useState(false);
  const [reviewedById, setReviewedById] = useState(ecn?.reviewedById ?? "");
  const [reviewedAt, setReviewedAt] = useState(toDateInputValue(ecn?.reviewedAt));
  const [addingReviewed, setAddingReviewed] = useState(false);
  const [approvedById, setApprovedById] = useState(ecn?.approvedById ?? "");
  const [approvedAt, setApprovedAt] = useState(toDateInputValue(ecn?.approvedAt));
  const [addingApproved, setAddingApproved] = useState(false);

  function addUser(user: { id: string; name: string }) {
    setLocalUsers((prev) => [...prev, user].sort((a, b) => a.name.localeCompare(b.name)));
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        const saved = await saveEcn(ecn?.id ?? null, ppapElementId, formData);
        router.push(`/ppap/${ppapId}/2/${saved.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save ECN.");
      }
    });
  }

  const d = ecn
    ? {
        partNameSnapshot: ecn.partNameSnapshot ?? "",
        partNumberSnapshot: ecn.partNumberSnapshot ?? "",
        customerNameSnapshot: ecn.customerNameSnapshot ?? "",
        drawingNumberSnapshot: ecn.drawingNumberSnapshot ?? "",
        drawingRevisionSnapshot: ecn.drawingRevisionSnapshot ?? "",
      }
    : masterDefaults!;

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <Link href={`/ppap/${ppapId}/2`} className="text-sm text-muted-foreground hover:underline">
          ← Back to ECN Log
        </Link>
        {ecn?.status === "APPROVED" && newRevisionLabel ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Approved — created Rev. {newRevisionLabel}</span>
            <Button
              type="button"
              size="sm"
              disabled={isCloning}
              onClick={() =>
                startCloneTransition(async () => {
                  await cloneToNewRevision(ecn.id);
                })
              }
            >
              {isCloning ? "Cloning..." : "Clone PPAP to new revision"}
            </Button>
          </div>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{ecn ? `ECN ${ecn.ecnNumber}` : "New ECN"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form ref={formRef} action={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="ecnNumber">ECN Number</Label>
                <Input id="ecnNumber" name="ecnNumber" defaultValue={ecn?.ecnNumber ?? ""} disabled={locked} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ecnDate">Date</Label>
                <Input id="ecnDate" name="ecnDate" type="date" defaultValue={toDateInputValue(ecn?.ecnDate)} disabled={locked} />
              </div>
            </div>

            <section className="grid grid-cols-2 gap-3 rounded-md border p-3">
              <p className="col-span-2 text-xs text-muted-foreground">
                Snapshot of part/customer/drawing at the time of this ECN — won&apos;t change if master data
                changes later.
              </p>
              <div className="space-y-1">
                <Label htmlFor="partNameSnapshot">Part Name</Label>
                <Input id="partNameSnapshot" name="partNameSnapshot" defaultValue={d.partNameSnapshot} disabled={locked} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="partNumberSnapshot">Part Number</Label>
                <Input id="partNumberSnapshot" name="partNumberSnapshot" defaultValue={d.partNumberSnapshot} disabled={locked} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="customerNameSnapshot">Customer Name</Label>
                <Input id="customerNameSnapshot" name="customerNameSnapshot" defaultValue={d.customerNameSnapshot} disabled={locked} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="drawingNumberSnapshot">Drawing Number</Label>
                <Input id="drawingNumberSnapshot" name="drawingNumberSnapshot" defaultValue={d.drawingNumberSnapshot} disabled={locked} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="drawingRevisionSnapshot">Drawing Revision</Label>
                <Input id="drawingRevisionSnapshot" name="drawingRevisionSnapshot" defaultValue={d.drawingRevisionSnapshot} disabled={locked} />
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="department">Department</Label>
                <Input id="department" name="department" defaultValue={ecn?.department ?? ""} disabled={locked} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="changeType">Type of Change</Label>
                <select
                  id="changeType"
                  name="changeType"
                  defaultValue={ecn?.changeType ?? ""}
                  disabled={locked}
                  className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
                >
                  <option value="">— Select —</option>
                  <option value="DESIGN">Design</option>
                  <option value="PROCESS">Process</option>
                  <option value="MATERIAL">Material</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="reason">Reason for Change</Label>
              <Textarea id="reason" name="reason" defaultValue={ecn?.reason ?? ""} disabled={locked} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="existingCondition">Description of Existing Condition</Label>
              <Textarea id="existingCondition" name="existingCondition" defaultValue={ecn?.existingCondition ?? ""} disabled={locked} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="proposedChange">Description of Proposed Change</Label>
              <Textarea id="proposedChange" name="proposedChange" defaultValue={ecn?.proposedChange ?? ""} disabled={locked} />
            </div>

            <section className="space-y-3 rounded-md border p-3">
              <h3 className="text-sm font-semibold">Impact Assessment (Quality/Cost/Delivery)</h3>
              {(
                [
                  { key: "Quality", levelField: "impactQualityLevel", noteField: "impactQualityNote", level: ecn?.impactQualityLevel, note: ecn?.impactQualityNote },
                  { key: "Cost", levelField: "impactCostLevel", noteField: "impactCostNote", level: ecn?.impactCostLevel, note: ecn?.impactCostNote },
                  { key: "Delivery", levelField: "impactDeliveryLevel", noteField: "impactDeliveryNote", level: ecn?.impactDeliveryLevel, note: ecn?.impactDeliveryNote },
                ] as const
              ).map((row) => (
                <div key={row.key} className="grid grid-cols-[100px_140px_1fr] items-end gap-2">
                  <Label>{row.key}</Label>
                  <select
                    name={row.levelField}
                    defaultValue={row.level ?? ""}
                    disabled={locked}
                    className="h-9 rounded-md border bg-transparent px-2 text-sm"
                  >
                    <option value="">— Select —</option>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                  <Input name={row.noteField} defaultValue={row.note ?? ""} disabled={locked} placeholder="Note" />
                </div>
              ))}
            </section>

            <section className="space-y-2 rounded-md border p-3">
              <h3 className="text-sm font-semibold">Affected Documents (Drawings, SOP, WI, etc.)</h3>
              <div className="grid grid-cols-2 gap-1 text-sm sm:grid-cols-3">
                {AFFECTED_ELEMENT_NUMBERS.map((n) => (
                  <label key={n} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      name="affectedElementNos"
                      value={n}
                      defaultChecked={ecn?.affectedElementNos.includes(n) ?? false}
                      disabled={locked}
                    />
                    {n}. {PPAP_ELEMENT_NAMES[n]}
                  </label>
                ))}
              </div>
              <div className="space-y-1">
                <Label htmlFor="affectedDocsFreeText">Other affected SOP/WI (free text)</Label>
                <Input
                  id="affectedDocsFreeText"
                  name="affectedDocsFreeText"
                  defaultValue={ecn?.affectedDocsFreeText ?? ""}
                  disabled={locked}
                />
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="stockDisposition">Stock Disposition</Label>
                <select
                  id="stockDisposition"
                  name="stockDisposition"
                  defaultValue={ecn?.stockDisposition ?? ""}
                  disabled={locked}
                  className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
                >
                  <option value="">— Select —</option>
                  <option value="USE">Use</option>
                  <option value="REJECT">Reject</option>
                  <option value="REWORK">Rework</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="implementationDate">Implementation Date</Label>
                <Input
                  id="implementationDate"
                  name="implementationDate"
                  type="date"
                  defaultValue={toDateInputValue(ecn?.implementationDate)}
                  disabled={locked}
                />
              </div>
            </div>

            <section className="grid gap-4 rounded-md border p-3 sm:grid-cols-3">
              <input type="hidden" name="preparedById" value={preparedById} />
              <input type="hidden" name="preparedAt" value={preparedAt} />
              <input type="hidden" name="reviewedById" value={reviewedById} />
              <input type="hidden" name="reviewedAt" value={reviewedAt} />
              <input type="hidden" name="approvedById" value={approvedById} />
              <input type="hidden" name="approvedAt" value={approvedAt} />
              <SignerField
                label="Prepared by"
                idPrefix="ecn-prepared"
                users={localUsers}
                byId={preparedById}
                setById={setPreparedById}
                at={preparedAt}
                setAt={setPreparedAt}
                adding={addingPrepared}
                setAdding={setAddingPrepared}
                onUserCreated={(u) => { addUser(u); setPreparedById(u.id); setAddingPrepared(false); }}
                disabled={locked}
              />
              <SignerField
                label="Reviewed by"
                idPrefix="ecn-reviewed"
                users={localUsers}
                byId={reviewedById}
                setById={setReviewedById}
                at={reviewedAt}
                setAt={setReviewedAt}
                adding={addingReviewed}
                setAdding={setAddingReviewed}
                onUserCreated={(u) => { addUser(u); setReviewedById(u.id); setAddingReviewed(false); }}
                disabled={locked}
              />
              <SignerField
                label="Approved by"
                idPrefix="ecn-approved"
                users={localUsers}
                byId={approvedById}
                setById={setApprovedById}
                at={approvedAt}
                setAt={setApprovedAt}
                adding={addingApproved}
                setAdding={setAddingApproved}
                onUserCreated={(u) => { addUser(u); setApprovedById(u.id); setAddingApproved(false); }}
                disabled={locked}
              />
            </section>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {!locked ? (
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save ECN"}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">This ECN is approved and locked.</p>
            )}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
