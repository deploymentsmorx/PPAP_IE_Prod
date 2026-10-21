"use client";

import { useRef, useState, useTransition } from "react";
import {
  updateDesignRecordDetail,
  upsertSpecialCharacteristic,
  deleteSpecialCharacteristic,
  uploadDrawingFile,
  deleteDrawingFile,
  renameDrawingFileRevision,
  uploadBallooningImage,
  removeBallooningImage,
  upsertBalloon,
  deleteBalloon,
} from "@/lib/actions/design-record";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateIndia } from "@/lib/format";
import type { Prisma } from "@/app/generated/prisma/client";

type Detail = Prisma.DesignRecordDetailGetPayload<{
  include: { materialSpec: { select: { id: true; standard: true; grade: true } } };
}> | null;
type MaterialSpec = Prisma.MaterialSpecGetPayload<{ select: { id: true; standard: true; grade: true } }>;
type SpecialCharacteristic = Prisma.SpecialCharacteristicGetPayload<object>;
type DrawingFile = Prisma.DrawingFileGetPayload<object>;
type Balloon = Prisma.BalloonGetPayload<object>;

export function DesignRecordForm({
  ppapElementId,
  locked,
  master,
  detail,
  materialSpecs,
  specialCharacteristics,
  drawingFiles,
  balloons,
}: {
  ppapElementId: string;
  locked: boolean;
  master: {
    partId: string;
    partName: string;
    partNumber: string;
    customerId: string;
    customerName: string;
    partRevisionId: string;
    drawingNumber: string;
    drawingRevision: string;
  };
  detail: Detail;
  materialSpecs: MaterialSpec[];
  specialCharacteristics: SpecialCharacteristic[];
  drawingFiles: DrawingFile[];
  balloons: Balloon[];
}) {
  return (
    <div className="space-y-8">
      <DetailTable
        ppapElementId={ppapElementId}
        locked={locked}
        master={master}
        detail={detail}
        materialSpecs={materialSpecs}
      />
      <SpecialCharacteristicsTable
        ppapElementId={ppapElementId}
        locked={locked}
        rows={specialCharacteristics}
      />
      <DrawingFilesSection ppapElementId={ppapElementId} locked={locked} files={drawingFiles} />
      <BallooningSection
        ppapElementId={ppapElementId}
        locked={locked}
        ballooningImageUrl={detail?.ballooningImageUrl ?? null}
        ballooningImageName={detail?.ballooningImageName ?? null}
        balloons={balloons}
      />
    </div>
  );
}

function Row({
  no,
  particular,
  details,
  remarksName,
  defaultRemarks,
  locked,
}: {
  no: number;
  particular: string;
  details: React.ReactNode;
  remarksName: string;
  defaultRemarks: string | null | undefined;
  locked: boolean;
}) {
  return (
    <TableRow>
      <TableCell className="w-10 text-muted-foreground">{no}</TableCell>
      <TableCell className="w-48 font-medium">{particular}</TableCell>
      <TableCell>{details}</TableCell>
      <TableCell className="w-56">
        <Input
          name={remarksName}
          defaultValue={defaultRemarks ?? ""}
          disabled={locked}
          placeholder="Remarks"
        />
      </TableCell>
    </TableRow>
  );
}

function DetailTable({
  ppapElementId,
  locked,
  master,
  detail,
  materialSpecs,
}: {
  ppapElementId: string;
  locked: boolean;
  master: {
    partId: string;
    partName: string;
    partNumber: string;
    customerId: string;
    customerName: string;
    partRevisionId: string;
    drawingNumber: string;
    drawingRevision: string;
  };
  detail: Detail;
  materialSpecs: MaterialSpec[];
}) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await updateDesignRecordDetail(ppapElementId, formData);
    });
  }

  return (
    <form ref={formRef} action={handleSubmit}>
      <p className="mb-2 text-xs text-muted-foreground">
        Part, customer, and drawing fields below are master data shared across every PPAP for
        this part — editing them here updates the shared record, not just this page.
      </p>
      <input type="hidden" name="partId" value={master.partId} />
      <input type="hidden" name="customerId" value={master.customerId} />
      <input type="hidden" name="partRevisionId" value={master.partRevisionId} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sl.</TableHead>
            <TableHead>Particular</TableHead>
            <TableHead>Details</TableHead>
            <TableHead>Remarks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <Row
            no={1}
            particular="Part Name"
            details={<Input name="partName" defaultValue={master.partName} disabled={locked} required />}
            remarksName="partNameRemarks"
            defaultRemarks={detail?.partNameRemarks}
            locked={locked}
          />
          <Row
            no={2}
            particular="Part Number"
            details={<Input name="partNumber" defaultValue={master.partNumber} disabled={locked} required />}
            remarksName="partNumberRemarks"
            defaultRemarks={detail?.partNumberRemarks}
            locked={locked}
          />
          <Row
            no={3}
            particular="Customer Name"
            details={<Input name="customerName" defaultValue={master.customerName} disabled={locked} required />}
            remarksName="customerNameRemarks"
            defaultRemarks={detail?.customerNameRemarks}
            locked={locked}
          />
          <Row
            no={4}
            particular="Drawing Number"
            details={<Input name="drawingNumber" defaultValue={master.drawingNumber} disabled={locked} required />}
            remarksName="drawingNumberRemarks"
            defaultRemarks={detail?.drawingNumberRemarks}
            locked={locked}
          />
          <Row
            no={5}
            particular="Drawing Revision"
            details={<Input name="drawingRevision" defaultValue={master.drawingRevision} disabled={locked} required />}
            remarksName="drawingRevisionRemarks"
            defaultRemarks={detail?.drawingRevisionRemarks}
            locked={locked}
          />
          <Row
            no={6}
            particular="Material Specification"
            details={
              <select
                name="materialSpecId"
                defaultValue={detail?.materialSpecId ?? ""}
                disabled={locked}
                className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
              >
                <option value="">— Select —</option>
                {materialSpecs.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.standard} {m.grade}
                  </option>
                ))}
              </select>
            }
            remarksName="materialSpecRemarks"
            defaultRemarks={detail?.materialSpecRemarks}
            locked={locked}
          />
          <Row
            no={7}
            particular="Heat Treatment"
            details={
              <Input name="heatTreatment" defaultValue={detail?.heatTreatment ?? ""} disabled={locked} />
            }
            remarksName="heatTreatmentRemarks"
            defaultRemarks={detail?.heatTreatmentRemarks}
            locked={locked}
          />
          <Row
            no={8}
            particular="Surface Finish"
            details={
              <Input name="surfaceFinish" defaultValue={detail?.surfaceFinish ?? ""} disabled={locked} />
            }
            remarksName="surfaceFinishRemarks"
            defaultRemarks={detail?.surfaceFinishRemarks}
            locked={locked}
          />
          <Row
            no={9}
            particular="Special Characteristics"
            details={<span className="text-muted-foreground">See table below</span>}
            remarksName="specialCharacteristicsRemarks"
            defaultRemarks={detail?.specialCharacteristicsRemarks}
            locked={locked}
          />
        </TableBody>
      </Table>
      {!locked ? (
        <Button type="submit" size="sm" className="mt-3" disabled={isPending}>
          {isPending ? "Saving..." : "Save"}
        </Button>
      ) : null}
    </form>
  );
}

type SpecialCharDraft = { characteristic: string; charClass: "CRITICAL" | "MAJOR"; symbol: string; drawingRef: string };

const EMPTY_SPECIAL_CHAR: SpecialCharDraft = { characteristic: "", charClass: "CRITICAL", symbol: "", drawingRef: "" };

function SpecialCharacteristicsTable({
  ppapElementId,
  locked,
  rows,
}: {
  ppapElementId: string;
  locked: boolean;
  rows: SpecialCharacteristic[];
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<SpecialCharDraft>(EMPTY_SPECIAL_CHAR);

  function startAdd() {
    setDraft(EMPTY_SPECIAL_CHAR);
    setEditingId(null);
    setAdding(true);
  }

  function startEdit(row: SpecialCharacteristic) {
    setDraft({
      characteristic: row.characteristic,
      charClass: row.charClass,
      symbol: row.symbol ?? "",
      drawingRef: row.drawingRef ?? "",
    });
    setAdding(false);
    setEditingId(row.id);
  }

  function cancel() {
    setAdding(false);
    setEditingId(null);
  }

  function save() {
    startTransition(async () => {
      await upsertSpecialCharacteristic(ppapElementId, { id: editingId ?? undefined, ...draft });
      setAdding(false);
      setEditingId(null);
      setDraft(EMPTY_SPECIAL_CHAR);
    });
  }

  const editorOpen = adding || editingId !== null;

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">Special Characteristics</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Characteristic</TableHead>
            <TableHead>Class</TableHead>
            <TableHead>Symbol</TableHead>
            <TableHead>Drawing Ref</TableHead>
            {!locked ? <TableHead className="w-32">Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.characteristic}</TableCell>
              <TableCell>
                <Badge variant={row.charClass === "CRITICAL" ? "destructive" : "secondary"}>
                  {row.charClass}
                </Badge>
              </TableCell>
              <TableCell>{row.symbol ?? "—"}</TableCell>
              <TableCell>{row.drawingRef ?? "—"}</TableCell>
              {!locked ? (
                <TableCell className="flex gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(row)}>
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        await deleteSpecialCharacteristic(ppapElementId, row.id);
                      })
                    }
                  >
                    Delete
                  </Button>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No special characteristics yet.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      {!locked ? (
        editorOpen ? (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="sc-characteristic">Characteristic</Label>
              <Input
                id="sc-characteristic"
                value={draft.characteristic}
                onChange={(e) => setDraft((d) => ({ ...d, characteristic: e.target.value }))}
                className="w-48"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sc-class">Class</Label>
              <select
                id="sc-class"
                value={draft.charClass}
                onChange={(e) => setDraft((d) => ({ ...d, charClass: e.target.value as "CRITICAL" | "MAJOR" }))}
                className="h-9 rounded-md border bg-transparent px-2 text-sm"
              >
                <option value="CRITICAL">CRITICAL</option>
                <option value="MAJOR">MAJOR</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sc-symbol">Symbol</Label>
              <Input
                id="sc-symbol"
                value={draft.symbol}
                onChange={(e) => setDraft((d) => ({ ...d, symbol: e.target.value }))}
                className="w-24"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sc-drawing-ref">Drawing Ref</Label>
              <Input
                id="sc-drawing-ref"
                value={draft.drawingRef}
                onChange={(e) => setDraft((d) => ({ ...d, drawingRef: e.target.value }))}
                className="w-32"
              />
            </div>
            <Button type="button" size="sm" disabled={!draft.characteristic || isPending} onClick={save}>
              {editingId ? "Save" : "Add"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={cancel}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button type="button" size="sm" variant="outline" className="mt-3" onClick={startAdd}>
            Add row
          </Button>
        )
      ) : null}
    </section>
  );
}

function DrawingFilesSection({
  ppapElementId,
  locked,
  files,
}: {
  ppapElementId: string;
  locked: boolean;
  files: DrawingFile[];
}) {
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [revisionDraft, setRevisionDraft] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await uploadDrawingFile(ppapElementId, formData);
      formRef.current?.reset();
    });
  }

  function startEdit(f: DrawingFile) {
    setEditingId(f.id);
    setRevisionDraft(f.revision);
  }

  function saveRevision() {
    if (!editingId) return;
    startTransition(async () => {
      await renameDrawingFileRevision(ppapElementId, editingId, revisionDraft);
      setEditingId(null);
    });
  }

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">Drawing Files</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File</TableHead>
            <TableHead>Revision</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Uploaded</TableHead>
            {!locked ? <TableHead className="w-40">Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((f) => (
            <TableRow key={f.id}>
              <TableCell>
                <a href={f.fileUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  {f.fileName}
                </a>
              </TableCell>
              <TableCell>
                {editingId === f.id ? (
                  <Input
                    value={revisionDraft}
                    onChange={(e) => setRevisionDraft(e.target.value)}
                    className="h-8 w-20"
                  />
                ) : (
                  f.revision
                )}
              </TableCell>
              <TableCell>
                <Badge variant={f.status === "ACTIVE" ? "default" : "secondary"}>{f.status}</Badge>
              </TableCell>
              <TableCell>{formatDateIndia(f.uploadedAt)}</TableCell>
              {!locked ? (
                <TableCell className="flex gap-1">
                  {editingId === f.id ? (
                    <>
                      <Button type="button" size="sm" disabled={isPending} onClick={saveRevision}>
                        Save
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(f)}>
                        Rename rev.
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() =>
                          startTransition(async () => {
                            await deleteDrawingFile(ppapElementId, f.id);
                          })
                        }
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </TableCell>
              ) : null}
            </TableRow>
          ))}
          {files.length === 0 ? (
            <TableRow>
              <TableCell colSpan={locked ? 4 : 5} className="text-center text-muted-foreground">
                No drawing files uploaded yet.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      {!locked ? (
        <form ref={formRef} action={handleSubmit} className="mt-3 flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="drawing-revision">Revision</Label>
            <Input id="drawing-revision" name="revision" defaultValue="H" className="w-24" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="drawing-file">File</Label>
            <Input id="drawing-file" name="file" type="file" required />
          </div>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Uploading..." : "Upload"}
          </Button>
        </form>
      ) : null}
    </section>
  );
}

type BalloonDraft = { balloonNo: string; viewSection: string; description: string; nominal: string; tolerance: string };

function BallooningSection({
  ppapElementId,
  locked,
  ballooningImageUrl,
  ballooningImageName,
  balloons,
}: {
  ppapElementId: string;
  locked: boolean;
  ballooningImageUrl: string | null;
  ballooningImageName: string | null;
  balloons: Balloon[];
}) {
  const [isPending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const imageFormRef = useRef<HTMLFormElement>(null);
  const emptyDraft: BalloonDraft = {
    balloonNo: String(balloons.length + 1),
    viewSection: "",
    description: "",
    nominal: "",
    tolerance: "",
  };
  const [draft, setDraft] = useState<BalloonDraft>(emptyDraft);

  function handleImageSubmit(formData: FormData) {
    startTransition(async () => {
      await uploadBallooningImage(ppapElementId, formData);
      imageFormRef.current?.reset();
    });
  }

  function startAdd() {
    setDraft({ ...emptyDraft, balloonNo: String(balloons.length + 1) });
    setEditingId(null);
    setAdding(true);
  }

  function startEdit(b: Balloon) {
    setDraft({
      balloonNo: String(b.balloonNo),
      viewSection: b.viewSection ?? "",
      description: b.description ?? "",
      nominal: b.nominal ?? "",
      tolerance: b.tolerance ?? "",
    });
    setAdding(false);
    setEditingId(b.id);
  }

  function cancel() {
    setAdding(false);
    setEditingId(null);
  }

  function save() {
    startTransition(async () => {
      await upsertBalloon(ppapElementId, {
        id: editingId ?? undefined,
        ...draft,
        balloonNo: Number(draft.balloonNo),
      });
      setAdding(false);
      setEditingId(null);
      setDraft(emptyDraft);
    });
  }

  const editorOpen = adding || editingId !== null;

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">Ballooned Drawing</h3>

      {ballooningImageUrl ? (
        <div className="mb-3 flex items-center gap-3 text-sm">
          <a href={ballooningImageUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            {ballooningImageName ?? "View ballooned drawing"}
          </a>
          {!locked ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => startTransition(async () => { await removeBallooningImage(ppapElementId); })}
            >
              Remove
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="mb-3 text-sm text-muted-foreground">No ballooned drawing uploaded yet.</p>
      )}

      {!locked ? (
        <form ref={imageFormRef} action={handleImageSubmit} className="mb-4 flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="ballooning-file">Upload image/PDF</Label>
            <Input id="ballooning-file" name="file" type="file" required />
          </div>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Uploading..." : "Upload"}
          </Button>
        </form>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Balloon No.</TableHead>
            <TableHead>View/Section</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Nominal</TableHead>
            <TableHead>Tolerance</TableHead>
            {!locked ? <TableHead className="w-32">Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {balloons.map((b) => (
            <TableRow key={b.id}>
              <TableCell>{b.balloonNo}</TableCell>
              <TableCell>{b.viewSection ?? "—"}</TableCell>
              <TableCell>{b.description ?? "—"}</TableCell>
              <TableCell>{b.nominal ?? "—"}</TableCell>
              <TableCell>{b.tolerance ?? "—"}</TableCell>
              {!locked ? (
                <TableCell className="flex gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(b)}>
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        await deleteBalloon(ppapElementId, b.id);
                      })
                    }
                  >
                    Delete
                  </Button>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
          {balloons.length === 0 ? (
            <TableRow>
              <TableCell colSpan={locked ? 5 : 6} className="text-center text-muted-foreground">
                No balloons yet.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      {!locked ? (
        editorOpen ? (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="balloon-no">Balloon No.</Label>
              <Input
                id="balloon-no"
                type="number"
                value={draft.balloonNo}
                onChange={(e) => setDraft((d) => ({ ...d, balloonNo: e.target.value }))}
                className="w-20"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="balloon-view-section">View/Section</Label>
              <Input
                id="balloon-view-section"
                value={draft.viewSection}
                onChange={(e) => setDraft((d) => ({ ...d, viewSection: e.target.value }))}
                className="w-32"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="balloon-description">Description</Label>
              <Input
                id="balloon-description"
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                className="w-48"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="balloon-nominal">Nominal</Label>
              <Input
                id="balloon-nominal"
                value={draft.nominal}
                onChange={(e) => setDraft((d) => ({ ...d, nominal: e.target.value }))}
                className="w-24"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="balloon-tolerance">Tolerance</Label>
              <Input
                id="balloon-tolerance"
                value={draft.tolerance}
                onChange={(e) => setDraft((d) => ({ ...d, tolerance: e.target.value }))}
                className="w-24"
              />
            </div>
            <Button type="button" size="sm" disabled={!draft.balloonNo || isPending} onClick={save}>
              {editingId ? "Save" : "Add"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={cancel}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button type="button" size="sm" variant="outline" className="mt-3" onClick={startAdd}>
            Add balloon
          </Button>
        )
      ) : null}
    </section>
  );
}
