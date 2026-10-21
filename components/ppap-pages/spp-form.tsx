"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveSpp,
  addSppSample,
  deleteSppSample,
  addSppFunctionalTest,
  deleteSppFunctionalTest,
  uploadSppPackagingPhoto,
  deleteSppPackagingPhoto,
} from "@/lib/actions/spp";
import { SPP_DECLARATION_TEXT } from "@/lib/calc/spp";
import { SignerField } from "@/components/signer-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitFormData } from "@/lib/form";
import type { Prisma } from "@/app/generated/prisma/client";

type Detail = Prisma.SppDetailGetPayload<{ include: { declaredBy: true } }> | null;
type Sample = Prisma.SppSampleGetPayload<object>;
type Test = Prisma.SppFunctionalTestGetPayload<object>;
type Photo = Prisma.SppPackagingPhotoGetPayload<object>;

function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

/**
 * Element 14's single form. Editable sections (1 date, 2, 6, 9, 10) are
 * rendered here; read-only sections (1 master fields, 3, 4, 5, 7, 8) are
 * server components passed in as slots so the page reads in sheet order.
 */
export function SppForm({
  ppapId,
  ppapElementId,
  locked,
  detail,
  samples,
  tests,
  photos,
  users,
  slots,
}: {
  ppapId: string;
  ppapElementId: string;
  locked: boolean;
  detail: Detail;
  samples: Sample[];
  tests: Test[];
  photos: Photo[];
  users: { id: string; name: string }[];
  slots: {
    general: React.ReactNode;
    material: React.ReactNode;
    dimensional: React.ReactNode;
    appearance: React.ReactNode;
    process: React.ReactNode;
    msa: React.ReactNode;
  };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [declaredById, setDeclaredById] = useState(detail?.declaredById ?? "");
  const [declaredAt, setDeclaredAt] = useState(toDateInputValue(detail?.declaredAt));
  const [addingSignatory, setAddingSignatory] = useState(false);
  const [localUsers, setLocalUsers] = useState(users);
  const photoInputRef = useRef<HTMLInputElement>(null);

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

  function handleUploadPhoto() {
    const file = photoInputRef.current?.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    run(async () => {
      await uploadSppPackagingPhoto(ppapElementId, formData);
      if (photoInputRef.current) photoInputRef.current.value = "";
    });
  }

  return (
    <form onSubmit={submitFormData((formData) => run(() => saveSpp(ppapElementId, formData), "Saved."))} className="space-y-6">
      {slots.general}

      {/* 2. Sample part details */}
      <section className="space-y-3 rounded-md border p-3" data-section="2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">2. Sample Part Details</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sample Quantity Submitted: {samples.length}</span>
            {samples.length > 0 ? (
              <Button render={<Link href={`/ppap/${ppapId}/14/tags`} target="_blank" />} nativeButton={false} variant="outline" size="sm">
                Print sample tags
              </Button>
            ) : null}
            {!locked ? (
              <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => run(() => addSppSample(ppapElementId))}>
                + Add sample
              </Button>
            ) : null}
          </div>
        </div>
        {samples.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="p-1">Sample ID</th>
                  <th className="p-1">Lot / Batch No</th>
                  <th className="p-1">Manufacturing Date</th>
                  <th className="p-1">Shift</th>
                  <th className="p-1">Machine No</th>
                  <th className="p-1">Cavity No (if applicable)</th>
                  {!locked ? <th className="w-10 p-1" /> : null}
                </tr>
              </thead>
              <tbody>
                {samples.map((s) => (
                  <tr key={s.id} className="border-b">
                    <td className="p-1">
                      <Input name={`sample-${s.id}-sampleId`} aria-label="Sample ID" defaultValue={s.sampleId} disabled={locked} className="h-8" required />
                    </td>
                    <td className="p-1">
                      <Input name={`sample-${s.id}-lotBatchNo`} aria-label={`${s.sampleId} lot / batch no`} defaultValue={s.lotBatchNo ?? ""} disabled={locked} className="h-8" />
                    </td>
                    <td className="p-1">
                      <Input
                        name={`sample-${s.id}-manufacturingDate`}
                        type="date"
                        aria-label={`${s.sampleId} manufacturing date`}
                        defaultValue={toDateInputValue(s.manufacturingDate)}
                        disabled={locked}
                        className="h-8"
                      />
                    </td>
                    <td className="p-1">
                      <Input name={`sample-${s.id}-shift`} aria-label={`${s.sampleId} shift`} defaultValue={s.shift ?? ""} disabled={locked} className="h-8" />
                    </td>
                    <td className="p-1">
                      <Input name={`sample-${s.id}-machineNo`} aria-label={`${s.sampleId} machine no`} defaultValue={s.machineNo ?? ""} disabled={locked} className="h-8" />
                    </td>
                    <td className="p-1">
                      <Input name={`sample-${s.id}-cavityNo`} aria-label={`${s.sampleId} cavity no`} defaultValue={s.cavityNo ?? ""} disabled={locked} className="h-8" />
                    </td>
                    {!locked ? (
                      <td className="p-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label={`Delete sample ${s.sampleId}`}
                          disabled={isPending}
                          onClick={() => run(() => deleteSppSample(s.id, ppapElementId))}
                        >
                          ✕
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No samples registered yet.</p>
        )}
      </section>

      {slots.material}
      {slots.dimensional}
      {slots.appearance}

      {/* 6. Functional / performance tests */}
      <section className="space-y-3 rounded-md border p-3" data-section="6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">6. Functional / Performance Test</h3>
          {!locked ? (
            <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => run(() => addSppFunctionalTest(ppapElementId))}>
              + Add test
            </Button>
          ) : null}
        </div>
        {tests.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="p-1">Test Name</th>
                <th className="p-1">Specification</th>
                <th className="p-1">Result</th>
                <th className="w-28 p-1">Status</th>
                {!locked ? <th className="w-10 p-1" /> : null}
              </tr>
            </thead>
            <tbody>
              {tests.map((t, i) => (
                <tr key={t.id} className="border-b">
                  <td className="p-1">
                    <Input name={`test-${t.id}-testName`} aria-label={`Test ${i + 1} name`} defaultValue={t.testName} disabled={locked} className="h-8" />
                  </td>
                  <td className="p-1">
                    <Input name={`test-${t.id}-specification`} aria-label={`Test ${i + 1} specification`} defaultValue={t.specification ?? ""} disabled={locked} className="h-8" />
                  </td>
                  <td className="p-1">
                    <Input name={`test-${t.id}-result`} aria-label={`Test ${i + 1} result`} defaultValue={t.result ?? ""} disabled={locked} className="h-8" />
                  </td>
                  <td className="p-1">
                    <select
                      name={`test-${t.id}-status`}
                      aria-label={`Test ${i + 1} status`}
                      defaultValue={t.status ?? ""}
                      disabled={locked}
                      className="h-8 w-full rounded-md border bg-transparent px-2 text-sm"
                    >
                      <option value="">—</option>
                      <option value="OK">OK</option>
                      <option value="NG">NG</option>
                    </select>
                  </td>
                  {!locked ? (
                    <td className="p-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={`Delete test ${i + 1}`}
                        disabled={isPending}
                        onClick={() => run(() => deleteSppFunctionalTest(t.id, ppapElementId))}
                      >
                        ✕
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">No functional tests recorded.</p>
        )}
      </section>

      {slots.process}
      {slots.msa}

      {/* 9. Packaging */}
      <section className="space-y-3 rounded-md border p-3" data-section="9">
        <h3 className="text-sm font-semibold">9. Packaging Details</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label htmlFor="spp-packingMethod">Packing Method</Label>
            <Input id="spp-packingMethod" name="packingMethod" defaultValue={detail?.packingMethod ?? ""} disabled={locked} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="spp-labelling">Labeling</Label>
            <Input id="spp-labelling" name="labelling" defaultValue={detail?.labelling ?? ""} disabled={locked} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="spp-protectionMethod">Protection Method</Label>
            <Input id="spp-protectionMethod" name="protectionMethod" defaultValue={detail?.protectionMethod ?? ""} disabled={locked} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <span key={p.id} className="relative">
              <a href={p.fileUrl} target="_blank" rel="noreferrer" title={p.fileName}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.fileUrl} alt="Packaging photo" className="h-20 w-20 rounded border object-cover" />
              </a>
              {!locked ? (
                <button
                  type="button"
                  aria-label={`Delete photo ${p.fileName}`}
                  className="absolute -right-1 -top-1 rounded-full bg-background px-1 text-xs leading-none text-destructive shadow"
                  disabled={isPending}
                  onClick={() => run(() => deleteSppPackagingPhoto(p.id, ppapElementId))}
                >
                  ×
                </button>
              ) : null}
            </span>
          ))}
        </div>
        {!locked ? (
          <div className="flex items-center gap-2">
            <input ref={photoInputRef} type="file" accept="image/*" aria-label="Packaging photo" className="text-xs" />
            <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handleUploadPhoto}>
              Upload photo
            </Button>
          </div>
        ) : null}
      </section>

      {/* 10. Declaration */}
      <section className="space-y-3 rounded-md border p-3" data-section="10">
        <h3 className="text-sm font-semibold">10. Declaration</h3>
        <p className="text-sm">{SPP_DECLARATION_TEXT}</p>
        <input type="hidden" name="declaredById" value={declaredById} />
        <input type="hidden" name="declaredAt" value={declaredAt} />
        <div className="max-w-sm">
          <SignerField
            label="Authorized Signatory"
            idPrefix="spp-declared"
            users={localUsers}
            byId={declaredById}
            setById={setDeclaredById}
            at={declaredAt}
            setAt={setDeclaredAt}
            adding={addingSignatory}
            setAdding={setAddingSignatory}
            onUserCreated={(u) => {
              setLocalUsers((prev) => [...prev, u].sort((a, b) => a.name.localeCompare(b.name)));
              setDeclaredById(u.id);
              setAddingSignatory(false);
            }}
            disabled={locked}
          />
        </div>
        {detail?.declaredBy ? (
          <p className="text-xs text-muted-foreground">Designation: {detail.declaredBy.designation ?? "—"}</p>
        ) : null}
      </section>

      {!locked ? (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save Sample Production Part"}
          </Button>
          {message ? <span className="text-sm text-muted-foreground">{message}</span> : null}
        </div>
      ) : message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}
    </form>
  );
}
