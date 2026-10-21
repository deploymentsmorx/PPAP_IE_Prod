"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSpcStudy } from "@/lib/actions/spc";
import type { SpcStudyResults } from "@/lib/actions/spc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SpcStudyForm } from "@/components/ppap-pages/spc-study-form";
import { SpcDataGrid } from "@/components/ppap-pages/spc-data-grid";
import { SpcResultsPanel } from "@/components/ppap-pages/spc-results-panel";
import { SpcCharts } from "@/components/ppap-pages/spc-charts";
import { formatDateIndia } from "@/lib/format";
import type { Prisma } from "@/app/generated/prisma/client";

type Study = Prisma.SpcStudyGetPayload<{ include: { readings: true; specialCharacteristic: true; instrument: true } }>;
type Instrument = { id: string; description: string; pickable: boolean };
type CharacteristicOption = { id: string; characteristic: string; charClass: string };

export function SpcStudyCard({
  ppapId,
  ppapElementId,
  locked,
  study,
  characteristics,
  instruments,
  results,
}: {
  ppapId: string;
  ppapElementId: string;
  locked: boolean;
  study: Study;
  characteristics: CharacteristicOption[];
  instruments: Instrument[];
  results: SpcStudyResults;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      await deleteSpcStudy(study.id, ppapElementId);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <SpcStudyForm
        ppapElementId={ppapElementId}
        study={study}
        characteristics={characteristics}
        instruments={instruments}
        onDone={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{study.specialCharacteristic?.characteristic || "(no characteristic set)"}</span>
          {study.specialCharacteristic ? <Badge variant="secondary">{study.specialCharacteristic.charClass}</Badge> : null}
          {study.specText ? <span className="text-xs text-muted-foreground">{study.specText}</span> : null}
          {study.usl != null && study.lsl != null ? (
            <span className="text-xs text-muted-foreground">
              USL {study.usl} / LSL {study.lsl}
            </span>
          ) : null}
          {study.instrument ? <span className="text-xs text-muted-foreground">{study.instrument.description}</span> : null}
          {study.studyDate ? <span className="text-xs text-muted-foreground">{formatDateIndia(study.studyDate)}</span> : null}
          <span className="text-xs text-muted-foreground">
            {study.subgroupCount} × {study.subgroupSize}
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

      {study.usl == null || study.lsl == null ? (
        <p className="rounded bg-muted px-3 py-2 text-xs text-muted-foreground">
          USL/LSL not set — pick a characteristic with a numeric Control Plan spec, or enter them manually in Edit Setup.
        </p>
      ) : null}

      <SpcDataGrid
        studyId={study.id}
        ppapElementId={ppapElementId}
        locked={locked}
        subgroupCount={study.subgroupCount}
        subgroupSize={study.subgroupSize}
        decimals={study.decimals}
        readings={study.readings}
      />

      <SpcResultsPanel ppapId={ppapId} results={results} />

      {results.complete && study.usl != null && study.lsl != null ? (
        <SpcCharts subgroupSize={study.subgroupSize} subgroupCount={study.subgroupCount} usl={study.usl} lsl={study.lsl} results={results} />
      ) : null}
    </div>
  );
}
