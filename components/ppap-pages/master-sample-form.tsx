"use client";

import Link from "next/link";
import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveMasterSamples,
  addMasterSample,
  deleteMasterSample,
  uploadMasterSampleImage,
  deleteMasterSampleImage,
} from "@/lib/actions/master-sample";
import { masterSampleExpiry, expiryState, daysUntil } from "@/lib/calc/master-sample";
import { formatDateIndia } from "@/lib/format";
import { ImageSlot } from "@/components/image-slot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { submitFormData } from "@/lib/form";
import type { Prisma } from "@/app/generated/prisma/client";

type Row = Prisma.MasterSampleGetPayload<{ include: { images: true } }> & { supersededByRevision: string | null };

function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

function ExpiryCell({ approval, retention }: { approval: string; retention: string }) {
  const expiry = masterSampleExpiry(approval ? new Date(`${approval}T00:00:00.000Z`) : null, retention === "" ? null : Number(retention));
  if (!expiry) return <span className="text-muted-foreground">—</span>;
  const state = expiryState(expiry);
  return (
    <div className="space-y-0.5">
      <div data-testid="expiry">{formatDateIndia(expiry)}</div>
      {state === "EXPIRED" ? <Badge variant="destructive">Expired</Badge> : null}
      {state === "EXPIRING_SOON" ? (
        <Badge variant="outline" className="border-0 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Expires in {daysUntil(expiry)} day(s)
        </Badge>
      ) : null}
    </div>
  );
}

export function MasterSampleForm({
  ppapId,
  ppapElementId,
  locked,
  master,
  rows,
}: {
  ppapId: string;
  ppapElementId: string;
  locked: boolean;
  master: { partName: string; partNumber: string; customerName: string; drawingNo: string; revision: string; level: number };
  rows: Row[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  // Approval date + retention drive the live expiry preview.
  const [draft, setDraft] = useState<Record<string, { approval: string; retention: string }>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, { approval: toDateInputValue(r.approvalDate), retention: r.retentionYears?.toString() ?? "" }])),
  );
  const valueOf = (r: Row) => draft[r.id] ?? { approval: toDateInputValue(r.approvalDate), retention: r.retentionYears?.toString() ?? "" };

  function run(action: () => Promise<unknown>, done?: string) {
    setMessage(null);
    startTransition(async () => {
      try {
        await action();
        if (done) setMessage(done);
        router.refresh();
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <form onSubmit={submitFormData((formData) => run(() => saveMasterSamples(ppapElementId, formData), "Saved."))} className="space-y-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border p-3 text-sm sm:grid-cols-3">
        {[
          ["Part Name", master.partName],
          ["Part No", master.partNumber],
          ["Customer", master.customerName],
          ["Drawing No", master.drawingNo],
          ["Rev", master.revision],
          ["PPAP Level", `L-${master.level}`],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Master Sample Register</h3>
        <div className="flex gap-2">
          {rows.length > 0 ? (
            <Button render={<Link href={`/ppap/${ppapId}/15/tags`} target="_blank" />} nativeButton={false} variant="outline" size="sm">
              Print QR tags
            </Button>
          ) : null}
          {!locked ? (
            <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => run(() => addMasterSample(ppapElementId))}>
              + Add master sample
            </Button>
          ) : null}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No master samples registered yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[60rem] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="p-1">Sample ID</th>
                <th className="p-1">Approval Date</th>
                <th className="p-1">Storage Location</th>
                <th className="w-24 p-1">Retention (years)</th>
                <th className="p-1">Expiry</th>
                <th className="w-36 p-1">Status</th>
                <th className="p-1">Remarks</th>
                {!locked ? <th className="w-10 p-1" /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const v = valueOf(r);
                return (
                  <Fragment key={r.id}>
                    <tr className="align-top" data-testid={`master-sample-${r.sampleId}`}>
                      <td className="p-1">
                        <Input name={`ms-${r.id}-sampleId`} aria-label="Sample ID" defaultValue={r.sampleId} disabled={locked} className="h-8" required />
                      </td>
                      <td className="p-1">
                        <Input
                          name={`ms-${r.id}-approvalDate`}
                          type="date"
                          aria-label={`${r.sampleId} approval date`}
                          value={v.approval}
                          onChange={(e) => setDraft((d) => ({ ...d, [r.id]: { ...v, approval: e.target.value } }))}
                          disabled={locked}
                          className="h-8"
                        />
                      </td>
                      <td className="p-1">
                        <Input
                          name={`ms-${r.id}-storageLocation`}
                          aria-label={`${r.sampleId} storage location`}
                          defaultValue={r.storageLocation ?? ""}
                          disabled={locked}
                          className="h-8"
                        />
                      </td>
                      <td className="p-1">
                        <Input
                          name={`ms-${r.id}-retentionYears`}
                          type="number"
                          min={0}
                          max={100}
                          aria-label={`${r.sampleId} retention years`}
                          value={v.retention}
                          onChange={(e) => setDraft((d) => ({ ...d, [r.id]: { ...v, retention: e.target.value } }))}
                          disabled={locked}
                          className="h-8"
                        />
                      </td>
                      <td className="p-1 pt-2">
                        <ExpiryCell approval={v.approval} retention={v.retention} />
                      </td>
                      <td className="p-1">
                        <select
                          name={`ms-${r.id}-status`}
                          aria-label={`${r.sampleId} status`}
                          defaultValue={r.status}
                          disabled={locked}
                          className="h-8 w-full rounded-md border bg-transparent px-2 text-sm"
                        >
                          <option value="ACTIVE">Active</option>
                          <option value="SUPERSEDED">Superseded</option>
                          <option value="DISPOSED">Disposed</option>
                        </select>
                        {r.status === "SUPERSEDED" && r.supersededAt ? (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Auto-superseded {formatDateIndia(r.supersededAt)}
                            {r.supersededByRevision ? ` by Rev ${r.supersededByRevision}` : ""}
                          </p>
                        ) : null}
                      </td>
                      <td className="p-1">
                        <Input name={`ms-${r.id}-remarks`} aria-label={`${r.sampleId} remarks`} defaultValue={r.remarks ?? ""} disabled={locked} className="h-8" />
                      </td>
                      {!locked ? (
                        <td className="p-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-label={`Delete ${r.sampleId}`}
                            disabled={isPending}
                            onClick={() => run(() => deleteMasterSample(r.id, ppapElementId))}
                          >
                            ✕
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                    <tr className="border-b">
                      <td className="p-1 pb-3" colSpan={locked ? 7 : 8}>
                        <div className="text-xs font-medium text-muted-foreground">Image Ref. — {r.sampleId}</div>
                        <ImageSlot
                          label={r.sampleId}
                          images={r.images.map((img) => ({ id: img.id, url: img.fileUrl, name: img.fileName }))}
                          locked={locked}
                          onUpload={async (formData) => {
                            await uploadMasterSampleImage(r.id, ppapElementId, formData);
                            router.refresh();
                          }}
                          onDelete={async (imageId) => {
                            await deleteMasterSampleImage(imageId, ppapElementId);
                            router.refresh();
                          }}
                        />
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!locked && rows.length > 0 ? (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save register"}
          </Button>
          {message ? <span className="text-sm text-muted-foreground">{message}</span> : null}
        </div>
      ) : message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}
    </form>
  );
}
