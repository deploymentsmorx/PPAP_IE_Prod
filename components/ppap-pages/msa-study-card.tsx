"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteStudy } from "@/lib/actions/msa";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MsaStudyForm } from "@/components/ppap-pages/msa-study-form";
import { MsaDataGrid } from "@/components/ppap-pages/msa-data-grid";
import { MsaResultsPanel } from "@/components/ppap-pages/msa-results-panel";
import { MsaCharts } from "@/components/ppap-pages/msa-charts";
import { formatDateIndia } from "@/lib/format";
import type { GrrReadings, GrrResult } from "@/lib/calc/grr";
import type { Prisma } from "@/app/generated/prisma/client";

type Study = Prisma.MsaStudyGetPayload<{ include: { dataPoints: true; gauge: true; controlPlanRow: true } }>;
type Instrument = { id: string; description: string; pickable: boolean };
type ControlPlanRowOption = { id: string; productCharacteristic: string | null; processCharacteristic: string | null };

const STUDY_TYPE_LABEL: Record<string, string> = {
  VARIABLE_GRR: "Variable GR&R",
  ATTRIBUTE_AGREEMENT: "Attribute Agreement",
  BIAS: "Bias",
  LINEARITY: "Linearity",
  STABILITY: "Stability",
};

function buildReadings(study: Study): GrrReadings {
  const readings: GrrReadings = Array.from({ length: study.appraisers }, () =>
    Array.from({ length: study.parts }, () => Array.from({ length: study.trials }, () => 0)),
  );
  for (const dp of study.dataPoints) {
    if (dp.value !== null) readings[dp.appraiserIndex][dp.partIndex][dp.trialIndex] = dp.value;
  }
  return readings;
}

export function MsaStudyCard({
  ppapId,
  ppapElementId,
  locked,
  study,
  instruments,
  controlPlanRows,
  complete,
  filled,
  expected,
  result,
}: {
  ppapId: string;
  ppapElementId: string;
  locked: boolean;
  study: Study;
  instruments: Instrument[];
  controlPlanRows: ControlPlanRowOption[];
  complete: boolean;
  filled: number;
  expected: number;
  result: GrrResult | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      await deleteStudy(study.id, ppapElementId);
      router.refresh();
    });
  }

  const characteristic = study.controlPlanRow?.productCharacteristic || study.controlPlanRow?.processCharacteristic || study.characteristicText;
  const partLabels = Array.from({ length: study.parts }, (_, i) => `Part ${i + 1}`);
  const appraiserNames = [study.appraiserAName ?? "", study.appraiserBName ?? "", study.appraiserCName ?? ""];

  if (editing) {
    return (
      <MsaStudyForm
        ppapElementId={ppapElementId}
        study={study}
        instruments={instruments}
        controlPlanRows={controlPlanRows}
        onDone={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{STUDY_TYPE_LABEL[study.studyType] ?? study.studyType}</Badge>
          <span className="text-sm font-semibold">{characteristic || "(no characteristic set)"}</span>
          {study.gauge ? <span className="text-xs text-muted-foreground">{study.gauge.description}</span> : null}
          {study.studyDate ? <span className="text-xs text-muted-foreground">{formatDateIndia(study.studyDate)}</span> : null}
          <span className="text-xs text-muted-foreground">
            {study.parts}p × {study.appraisers}o × {study.trials}n
          </span>
        </div>
        {!locked ? (
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
              Edit Setup
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={handleDelete} disabled={isPending}>
              Delete
            </Button>
          </div>
        ) : null}
      </div>

      {study.studyType !== "VARIABLE_GRR" ? (
        <div className="rounded bg-muted px-3 py-2 text-sm text-muted-foreground">
          {STUDY_TYPE_LABEL[study.studyType]} studies aren&apos;t computed yet — captured as notes only: {study.notes || "(none)"}
        </div>
      ) : study.method === "ANOVA" ? (
        <div className="rounded bg-muted px-3 py-2 text-xs text-muted-foreground">
          ANOVA method isn&apos;t implemented yet — showing Average &amp; Range results below instead.
        </div>
      ) : null}

      {study.studyType === "VARIABLE_GRR" ? (
        <>
          <MsaDataGrid
            studyId={study.id}
            ppapElementId={ppapElementId}
            locked={locked}
            parts={study.parts}
            appraisers={study.appraisers}
            trials={study.trials}
            appraiserNames={appraiserNames}
            dataPoints={study.dataPoints}
          />

          <MsaResultsPanel ppapId={ppapId} complete={complete} filled={filled} expected={expected} result={result} />

          {complete && result ? (
            <MsaCharts
              readings={buildReadings(study)}
              result={result}
              partLabels={partLabels}
              appraiserNames={appraiserNames}
              trials={study.trials}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
