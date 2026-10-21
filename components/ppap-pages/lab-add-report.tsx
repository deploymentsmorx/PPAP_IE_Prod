"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LabReportForm } from "@/components/ppap-pages/lab-report-form";

type LabOption = { id: string; name: string; pickable: boolean };
type MaterialSpecOption = { id: string; standard: string; grade: string };
type HeatOption = { id: string; heatNo: string; partNo: string | null };

export function LabAddReport({
  ppapElementId,
  labs,
  materialSpecs,
  heatOptions,
}: {
  ppapElementId: string;
  labs: LabOption[];
  materialSpecs: MaterialSpecOption[];
  heatOptions: HeatOption[];
}) {
  const [adding, setAdding] = useState(false);

  if (adding) {
    return (
      <LabReportForm
        ppapElementId={ppapElementId}
        report={null}
        labs={labs}
        materialSpecs={materialSpecs}
        heatOptions={heatOptions}
        onDone={() => setAdding(false)}
      />
    );
  }

  return (
    <Button type="button" size="sm" onClick={() => setAdding(true)}>
      + Add Report
    </Button>
  );
}
