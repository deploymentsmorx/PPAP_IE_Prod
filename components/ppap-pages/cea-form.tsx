"use client";

import { useRef, useState, useTransition } from "react";
import { saveCea, uploadCeaAttachment, deleteCeaAttachment } from "@/lib/actions/cea";
import { SignerField } from "@/components/signer-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PPAP_ELEMENT_NAMES } from "@/lib/constants/ppap-elements";
import { formatDateIndia } from "@/lib/format";
import type { Prisma } from "@/app/generated/prisma/client";

type Detail = Prisma.CeaDetailGetPayload<{ include: { declaredBy: true } }> | null;
type Attachment = Prisma.CeaAttachmentGetPayload<object>;

function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

const IMPACT_ROWS = [
  { key: "Fit", level: "impactFitLevel", note: "impactFitNote" },
  { key: "Form", level: "impactFormLevel", note: "impactFormNote" },
  { key: "Function", level: "impactFunctionLevel", note: "impactFunctionNote" },
  { key: "Quality Risk", level: "impactQualityRiskLevel", note: "impactQualityRiskNote" },
  { key: "Reliability/Life", level: "impactReliabilityLevel", note: "impactReliabilityNote" },
  { key: "Regulatory/Safety", level: "impactRegulatoryLevel", note: "impactRegulatoryNote" },
] as const;

export function CeaForm({
  ppapElementId,
  locked,
  master,
  detail,
  attachments,
  users,
}: {
  ppapElementId: string;
  locked: boolean;
  master: {
    customerName: string;
    supplierName: string;
    partName: string;
    partNumber: string;
    drawingNo: string;
    drawingRevision: string;
    project: string;
    level: number;
    requiredElementNos: number[];
  };
  detail: Detail;
  attachments: Attachment[];
  users: { id: string; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [requestType, setRequestType] = useState(detail?.requestType ?? "");
  const [declaredById, setDeclaredById] = useState(detail?.declaredById ?? "");
  const [declaredAt, setDeclaredAt] = useState(toDateInputValue(detail?.declaredAt));
  const [addingDeclarant, setAddingDeclarant] = useState(false);
  const [localUsers, setLocalUsers] = useState(users);

  const [isUploading, startUpload] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isNewPart = requestType === "NEW_PART";
  const isDeviation = requestType === "DEVIATION";

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await saveCea(ppapElementId, formData);
    });
  }

  function handleAttachmentUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    startUpload(async () => {
      await uploadCeaAttachment(ppapElementId, formData);
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-6">
      {/* 1. Header */}
      <section className="space-y-3 rounded-md border p-3">
        <h3 className="text-sm font-semibold">1. Header</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="ceaNo">CEA No.</Label>
            <Input
              id="ceaNo"
              name="ceaNo"
              defaultValue={detail?.ceaNo ?? `CEA-${master.project || "NBL"}-001`}
              disabled={locked}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ceaDate">Date</Label>
            <Input id="ceaDate" name="ceaDate" type="date" defaultValue={toDateInputValue(detail?.ceaDate)} disabled={locked} />
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Customer</dt>
          <dd>{master.customerName}</dd>
          <dt className="text-muted-foreground">Supplier</dt>
          <dd>{master.supplierName}</dd>
          <dt className="text-muted-foreground">Part</dt>
          <dd>{master.partName}</dd>
          <dt className="text-muted-foreground">Part No.</dt>
          <dd>{master.partNumber}</dd>
          <dt className="text-muted-foreground">Drawing No./Rev</dt>
          <dd>
            {master.drawingNo} / {master.drawingRevision}
          </dd>
          <dt className="text-muted-foreground">Project</dt>
          <dd>{master.project || "—"}</dd>
        </dl>
      </section>

      {/* 2. Request type */}
      <section className="space-y-2 rounded-md border p-3">
        <h3 className="text-sm font-semibold">2. Request Type</h3>
        <select
          name="requestType"
          value={requestType}
          disabled={locked}
          onChange={(e) => setRequestType(e.target.value)}
          className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
        >
          <option value="">— Select —</option>
          <option value="NEW_PART">New Part</option>
          <option value="ENGINEERING_CHANGE">Engineering Change</option>
          <option value="DEVIATION">Deviation</option>
          <option value="REVALIDATION">Revalidation</option>
        </select>
      </section>

      {/* 3. Change description */}
      <section className="space-y-3 rounded-md border p-3">
        <h3 className="text-sm font-semibold">
          3. Change Description {isNewPart ? <span className="text-xs text-muted-foreground">(optional for New Part)</span> : null}
        </h3>
        <div className="space-y-1">
          <Label htmlFor="existingCondition">Existing</Label>
          <Textarea
            id="existingCondition"
            name="existingCondition"
            defaultValue={detail?.existingCondition ?? (isNewPart ? "Initial submission" : "")}
            disabled={locked}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="proposedChange">Proposed</Label>
          <Textarea
            id="proposedChange"
            name="proposedChange"
            defaultValue={detail?.proposedChange ?? (isNewPart ? "Initial submission" : "")}
            disabled={locked}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="changeReason">Reason</Label>
          <Textarea
            id="changeReason"
            name="changeReason"
            defaultValue={detail?.changeReason ?? (isNewPart ? "Initial submission" : "")}
            disabled={locked}
          />
        </div>
      </section>

      {/* 4. Impact assessment */}
      <section className="space-y-3 rounded-md border p-3">
        <h3 className="text-sm font-semibold">
          4. Impact Assessment {isNewPart ? <span className="text-xs text-muted-foreground">(optional for New Part)</span> : null}
        </h3>
        {IMPACT_ROWS.map((row) => (
          <div key={row.key} className="grid grid-cols-[140px_140px_1fr] items-end gap-2">
            <Label>{row.key}</Label>
            <select
              name={row.level}
              defaultValue={detail?.[row.level] ?? (isNewPart ? "NONE" : "")}
              disabled={locked}
              className="h-9 rounded-md border bg-transparent px-2 text-sm"
            >
              <option value="">— Select —</option>
              <option value="NONE">None</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
            <Input name={row.note} defaultValue={detail?.[row.note] ?? ""} disabled={locked} placeholder="Note" />
          </div>
        ))}
      </section>

      {/* 5. Validation & verification */}
      <section className="space-y-3 rounded-md border p-3">
        <h3 className="text-sm font-semibold">5. Validation &amp; Verification</h3>
        <div className="space-y-1">
          <Label htmlFor="testsPerformed">Tests Performed</Label>
          <Textarea id="testsPerformed" name="testsPerformed" defaultValue={detail?.testsPerformed ?? ""} disabled={locked} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="testStandard">Standard</Label>
            <Input id="testStandard" name="testStandard" defaultValue={detail?.testStandard ?? ""} disabled={locked} />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="resultSummary">Result Summary</Label>
          <Textarea id="resultSummary" name="resultSummary" defaultValue={detail?.resultSummary ?? ""} disabled={locked} />
        </div>

        <div className="space-y-2">
          <Label>Attachments</Label>
          <ul className="space-y-1 text-sm">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-2">
                <a href={a.fileUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  {a.fileName}
                </a>
                {!locked ? (
                  <DeleteAttachmentButton attachmentId={a.id} ppapElementId={ppapElementId} />
                ) : null}
              </li>
            ))}
            {attachments.length === 0 ? <li className="text-muted-foreground">No attachments yet.</li> : null}
          </ul>
          {!locked ? (
            <div className="flex items-end gap-2">
              <Input ref={fileInputRef} name="file" type="file" required />
              <Button type="button" size="sm" disabled={isUploading} onClick={handleAttachmentUpload}>
                {isUploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      {/* 6. PPAP status */}
      <section className="space-y-2 rounded-md border p-3">
        <h3 className="text-sm font-semibold">6. PPAP Status</h3>
        <p className="text-sm">
          Level {master.level} — documents covered:{" "}
          {master.requiredElementNos.length
            ? master.requiredElementNos.map((n) => PPAP_ELEMENT_NAMES[n]).join(", ")
            : "Refer to checklist"}
        </p>
        <div className="space-y-1">
          <Label htmlFor="submissionStatus">Submission Status</Label>
          <Input
            id="submissionStatus"
            name="submissionStatus"
            defaultValue={detail?.submissionStatus ?? "Not yet submitted"}
            disabled={locked}
          />
        </div>
      </section>

      {/* 7. Deviation details */}
      {isDeviation ? (
        <section className="space-y-3 rounded-md border p-3">
          <h3 className="text-sm font-semibold">7. Deviation Details</h3>
          <div className="space-y-1">
            <Label htmlFor="deviationDescription">Description</Label>
            <Textarea id="deviationDescription" name="deviationDescription" defaultValue={detail?.deviationDescription ?? ""} disabled={locked} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="deviationQty">Quantity</Label>
              <Input id="deviationQty" name="deviationQty" defaultValue={detail?.deviationQty ?? ""} disabled={locked} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="deviationValidityPeriod">Validity Period</Label>
              <Input id="deviationValidityPeriod" name="deviationValidityPeriod" defaultValue={detail?.deviationValidityPeriod ?? ""} disabled={locked} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="deviationInterimContainment">Interim Containment</Label>
            <Textarea id="deviationInterimContainment" name="deviationInterimContainment" defaultValue={detail?.deviationInterimContainment ?? ""} disabled={locked} />
          </div>
        </section>
      ) : null}

      {/* 8. Sample information */}
      <section className="space-y-3 rounded-md border p-3">
        <h3 className="text-sm font-semibold">8. Sample Information</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label htmlFor="sampleQty">Quantity</Label>
            <Input id="sampleQty" name="sampleQty" defaultValue={detail?.sampleQty ?? ""} disabled={locked} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sampleLotNo">Lot No.</Label>
            <Input id="sampleLotNo" name="sampleLotNo" defaultValue={detail?.sampleLotNo ?? ""} disabled={locked} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sampleSubmissionDate">Submission Date</Label>
            <Input
              id="sampleSubmissionDate"
              name="sampleSubmissionDate"
              type="date"
              defaultValue={toDateInputValue(detail?.sampleSubmissionDate)}
              disabled={locked}
            />
          </div>
        </div>
      </section>

      {/* 9. Supplier declaration */}
      <section className="space-y-3 rounded-md border p-3">
        <h3 className="text-sm font-semibold">9. Supplier Declaration</h3>
        <p className="text-sm text-muted-foreground">
          We declare that the above change has been reviewed and, to the best of our knowledge, does not
          affect form, fit, or function beyond what is stated above, and that all applicable PPAP
          requirements continue to be met.
        </p>
        <input type="hidden" name="declaredById" value={declaredById} />
        <input type="hidden" name="declaredAt" value={declaredAt} />
        <div className="max-w-sm">
          <SignerField
            label="Declared by"
            idPrefix="cea-declared"
            users={localUsers}
            byId={declaredById}
            setById={setDeclaredById}
            at={declaredAt}
            setAt={setDeclaredAt}
            adding={addingDeclarant}
            setAdding={setAddingDeclarant}
            onUserCreated={(u) => {
              setLocalUsers((prev) => [...prev, u].sort((a, b) => a.name.localeCompare(b.name)));
              setDeclaredById(u.id);
              setAddingDeclarant(false);
            }}
            disabled={locked}
          />
        </div>
        {detail?.declaredBy ? (
          <p className="text-xs text-muted-foreground">
            {detail.declaredBy.name} ({detail.declaredBy.designation ?? "—"})
            {detail.declaredAt ? ` · ${formatDateIndia(detail.declaredAt)}` : ""}
          </p>
        ) : null}
      </section>

      {!locked ? (
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save CEA"}
        </Button>
      ) : null}
    </form>
  );
}

function DeleteAttachmentButton({ attachmentId, ppapElementId }: { attachmentId: string; ppapElementId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => startTransition(async () => { await deleteCeaAttachment(attachmentId, ppapElementId); })}
    >
      Delete
    </Button>
  );
}
