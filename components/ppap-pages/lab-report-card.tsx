"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteLabReport, uploadLabReportPdf } from "@/lib/actions/lab";
import { computeNumericStatus } from "@/lib/calc/lab";
import { parseRangeText } from "@/lib/calc/tolerance";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LabReportForm } from "@/components/ppap-pages/lab-report-form";
import { LabTestDetails } from "@/components/ppap-pages/lab-test-details";
import { LabMechanicalTable } from "@/components/ppap-pages/lab-mechanical-table";
import { LabChemicalTable } from "@/components/ppap-pages/lab-chemical-table";
import { LabPaintTable } from "@/components/ppap-pages/lab-paint-table";
import { formatDateIndia } from "@/lib/format";
import type { Prisma } from "@/app/generated/prisma/client";

type Report = Prisma.LabReportGetPayload<{
  include: {
    lab: true;
    materialSpec: { select: { id: true; standard: true; grade: true } };
    rmtcReportRow: true;
    testDetails: true;
    mechanicalResults: true;
    chemicalResults: true;
    paintResults: true;
  };
}>;
type LabOption = { id: string; name: string; pickable: boolean };
type MaterialSpecOption = { id: string; standard: string; grade: string };
type HeatOption = { id: string; heatNo: string; partNo: string | null };

function anyNg(report: Report): boolean {
  const mechNg = report.mechanicalResults.some((r) => computeNumericStatus(r.result, r.requirementMin, r.requirementMax) === "NG");
  const chemNg = report.chemicalResults.some((r) => computeNumericStatus(r.result, r.requirementMin, r.requirementMax) === "NG");
  const paintNg = report.paintResults.some((r) => {
    const range = parseRangeText(r.requirementText);
    return range && r.resultNumeric != null && computeNumericStatus(r.resultNumeric, range.min, range.max) === "NG";
  });
  return mechNg || chemNg || paintNg;
}

export function LabReportCard({
  ppapElementId,
  locked,
  report,
  labs,
  materialSpecs,
  heatOptions,
}: {
  ppapElementId: string;
  locked: boolean;
  report: Report;
  labs: LabOption[];
  materialSpecs: MaterialSpecOption[];
  heatOptions: HeatOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDelete() {
    startTransition(async () => {
      await deleteLabReport(report.id, ppapElementId);
      router.refresh();
    });
  }

  function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    startTransition(async () => {
      try {
        await uploadLabReportPdf(report.id, ppapElementId, formData);
        router.refresh();
      } finally {
        setUploading(false);
      }
    });
  }

  if (editing) {
    return (
      <LabReportForm
        ppapElementId={ppapElementId}
        report={report}
        labs={labs}
        materialSpecs={materialSpecs}
        heatOptions={heatOptions}
        onDone={() => setEditing(false)}
      />
    );
  }

  const flagged = anyNg(report);
  const materialGrade = report.materialSpec ? `${report.materialSpec.standard} ${report.materialSpec.grade}` : report.materialGradeText;
  const heatBatchNo = report.rmtcReportRow?.heatNo || report.heatBatchNoText;

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{report.reportNo || "(no report no.)"}</span>
          {report.lab ? <Badge variant="secondary">{report.lab.name}</Badge> : null}
          {materialGrade ? <span className="text-xs text-muted-foreground">{materialGrade}</span> : null}
          {heatBatchNo ? <span className="text-xs text-muted-foreground">Heat/Batch {heatBatchNo}</span> : null}
          {report.testDate ? <span className="text-xs text-muted-foreground">{formatDateIndia(report.testDate)}</span> : null}
          <Badge variant={flagged ? "destructive" : "outline"} className={flagged ? undefined : "border-0 bg-muted"}>
            {flagged ? "NG" : "OK"}
          </Badge>
        </div>
        {!locked ? (
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={handleDelete} disabled={isPending}>
              Delete
            </Button>
          </div>
        ) : null}
      </div>

      <div className="space-y-1">
        <h4 className="text-xs font-semibold">Tests Performed</h4>
        <LabTestDetails ppapElementId={ppapElementId} reportId={report.id} locked={locked} rows={report.testDetails} />
      </div>

      <div className="space-y-1">
        <h4 className="text-xs font-semibold">Mechanical Properties</h4>
        <LabMechanicalTable ppapElementId={ppapElementId} locked={locked} rows={report.mechanicalResults} />
      </div>

      <div className="space-y-1">
        <h4 className="text-xs font-semibold">Chemical Composition (%)</h4>
        <LabChemicalTable ppapElementId={ppapElementId} locked={locked} rows={report.chemicalResults} />
      </div>

      <div className="space-y-1">
        <h4 className="text-xs font-semibold">Paint</h4>
        <LabPaintTable ppapElementId={ppapElementId} locked={locked} rows={report.paintResults} />
      </div>

      <div className="flex items-center gap-2">
        {report.labPdfUrl ? (
          <a href={report.labPdfUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
            {report.labPdfName ?? "Signed Lab Report PDF"}
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">No signed lab report uploaded.</span>
        )}
        {!locked ? (
          <>
            <input ref={fileInputRef} type="file" accept="application/pdf" className="w-40 text-xs" />
            <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={handleUpload}>
              {uploading ? "Uploading..." : "Upload PDF"}
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
