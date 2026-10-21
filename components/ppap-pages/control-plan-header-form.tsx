"use client";

import { useRef, useTransition } from "react";
import { saveControlPlanHeader } from "@/lib/actions/control-plan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Prisma } from "@/app/generated/prisma/client";

type Detail = Prisma.ControlPlanDetailGetPayload<object> | null;

function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export function ControlPlanHeaderForm({
  ppapElementId,
  locked,
  detail,
}: {
  ppapElementId: string;
  locked: boolean;
  detail: Detail;
}) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await saveControlPlanHeader(ppapElementId, formData);
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-xs font-medium text-muted-foreground">Phase:</span>
        {([
          ["phasePrototype", "Prototype", detail?.phasePrototype],
          ["phasePreLaunch", "Pre-launch", detail?.phasePreLaunch],
          ["phaseProduction", "Production", detail?.phaseProduction],
        ] as const).map(([name, label, checked]) => (
          <label key={name} className="flex items-center gap-1 text-sm">
            <input type="checkbox" name={name} defaultChecked={checked ?? false} disabled={locked} />
            {label}
          </label>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="controlPlanNo">Control Plan No.</Label>
          <Input id="controlPlanNo" name="controlPlanNo" defaultValue={detail?.controlPlanNo ?? ""} disabled={locked} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="revisionNo">Revision No.</Label>
          <Input id="revisionNo" name="revisionNo" defaultValue={detail?.revisionNo ?? ""} disabled={locked} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dateOrig">Date (Orig.)</Label>
          <Input id="dateOrig" name="dateOrig" type="date" defaultValue={toDateInputValue(detail?.dateOrig)} disabled={locked} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dateRev">Date (Rev.)</Label>
          <Input id="dateRev" name="dateRev" type="date" defaultValue={toDateInputValue(detail?.dateRev)} disabled={locked} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="partDescription">Part Description</Label>
          <Input id="partDescription" name="partDescription" defaultValue={detail?.partDescription ?? ""} disabled={locked} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="customerPartNo">Customer Part No.</Label>
          <Input id="customerPartNo" name="customerPartNo" defaultValue={detail?.customerPartNo ?? ""} disabled={locked} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="customerPartRevision">Customer Part Rev.</Label>
          <Input id="customerPartRevision" name="customerPartRevision" defaultValue={detail?.customerPartRevision ?? ""} disabled={locked} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="partNo">Part No.</Label>
          <Input id="partNo" name="partNo" defaultValue={detail?.partNo ?? ""} disabled={locked} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="partRevision">Part Rev.</Label>
          <Input id="partRevision" name="partRevision" defaultValue={detail?.partRevision ?? ""} disabled={locked} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="supplier">Supplier</Label>
          <Input id="supplier" name="supplier" defaultValue={detail?.supplier ?? ""} disabled={locked} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="plant">Plant</Label>
          <Input id="plant" name="plant" defaultValue={detail?.plant ?? ""} disabled={locked} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="material">Material</Label>
          <Input id="material" name="material" defaultValue={detail?.material ?? ""} disabled={locked} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="keyContactPhone">Key Contact / Phone</Label>
          <Input id="keyContactPhone" name="keyContactPhone" defaultValue={detail?.keyContactPhone ?? ""} disabled={locked} />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="coreTeamText">Core Team</Label>
        <Textarea id="coreTeamText" name="coreTeamText" defaultValue={detail?.coreTeamText ?? ""} disabled={locked} className="h-16" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="supplierPlantApprovalDate">Supplier Plant Approval Date</Label>
          <Input
            id="supplierPlantApprovalDate"
            name="supplierPlantApprovalDate"
            type="date"
            defaultValue={toDateInputValue(detail?.supplierPlantApprovalDate)}
            disabled={locked}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="customerEngineeringApprovalDate">Customer Engineering Approval Date</Label>
          <Input
            id="customerEngineeringApprovalDate"
            name="customerEngineeringApprovalDate"
            type="date"
            defaultValue={toDateInputValue(detail?.customerEngineeringApprovalDate)}
            disabled={locked}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="customerQualityApprovalDate">Customer Quality Approval Date</Label>
          <Input
            id="customerQualityApprovalDate"
            name="customerQualityApprovalDate"
            type="date"
            defaultValue={toDateInputValue(detail?.customerQualityApprovalDate)}
            disabled={locked}
          />
        </div>
      </div>

      {!locked ? (
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save Header"}
        </Button>
      ) : null}
    </form>
  );
}
