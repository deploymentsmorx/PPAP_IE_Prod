"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SpcStudyForm } from "@/components/ppap-pages/spc-study-form";

type Instrument = { id: string; description: string; pickable: boolean };
type CharacteristicOption = { id: string; characteristic: string; charClass: string };

export function SpcAddStudy({
  ppapElementId,
  characteristics,
  instruments,
}: {
  ppapElementId: string;
  characteristics: CharacteristicOption[];
  instruments: Instrument[];
}) {
  const [adding, setAdding] = useState(false);

  if (adding) {
    return (
      <SpcStudyForm
        ppapElementId={ppapElementId}
        study={null}
        characteristics={characteristics}
        instruments={instruments}
        onDone={() => setAdding(false)}
      />
    );
  }

  return (
    <Button type="button" size="sm" onClick={() => setAdding(true)} disabled={characteristics.length === 0}>
      + Add Study
    </Button>
  );
}
