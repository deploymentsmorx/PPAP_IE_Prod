"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MsaStudyForm } from "@/components/ppap-pages/msa-study-form";

type Instrument = { id: string; description: string; pickable: boolean };
type ControlPlanRowOption = { id: string; productCharacteristic: string | null; processCharacteristic: string | null };

export function MsaAddStudy({
  ppapElementId,
  instruments,
  controlPlanRows,
}: {
  ppapElementId: string;
  instruments: Instrument[];
  controlPlanRows: ControlPlanRowOption[];
}) {
  const [adding, setAdding] = useState(false);

  if (adding) {
    return (
      <MsaStudyForm
        ppapElementId={ppapElementId}
        study={null}
        instruments={instruments}
        controlPlanRows={controlPlanRows}
        onDone={() => setAdding(false)}
      />
    );
  }

  return (
    <Button type="button" size="sm" onClick={() => setAdding(true)}>
      + Add Study
    </Button>
  );
}
