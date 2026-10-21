import { getControlPlanConsistencyChecks } from "@/lib/actions/control-plan";
import { Badge } from "@/components/ui/badge";

export async function ControlPlanConsistencyPanel({ ppapElementId }: { ppapElementId: string }) {
  const { rowsWithoutReactionPlan, overdueInstruments, missingPfmeaControls } =
    await getControlPlanConsistencyChecks(ppapElementId);

  const clean = rowsWithoutReactionPlan.length === 0 && overdueInstruments.length === 0 && missingPfmeaControls.length === 0;

  return (
    <section className="space-y-2 rounded-md border p-3">
      <h3 className="text-sm font-semibold">Consistency Checks</h3>
      {clean ? (
        <p className="text-sm text-muted-foreground">No issues found.</p>
      ) : (
        <div className="space-y-3 text-sm">
          {missingPfmeaControls.length > 0 ? (
            <div>
              <Badge variant="destructive">PFMEA controls missing here</Badge>
              <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                {missingPfmeaControls.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {overdueInstruments.length > 0 ? (
            <div>
              <Badge variant="destructive">Instruments overdue for calibration</Badge>
              <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                {overdueInstruments.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {rowsWithoutReactionPlan.length > 0 ? (
            <div>
              <Badge variant="secondary">Rows without a reaction plan</Badge>
              <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                {rowsWithoutReactionPlan.map((name, i) => (
                  <li key={`${name}-${i}`}>{name}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
