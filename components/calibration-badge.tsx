import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CalibrationStatus } from "@/lib/calc/calibration";

const LABEL: Record<CalibrationStatus, string> = {
  VALID: "Valid",
  DUE_SOON: "Due soon",
  OVERDUE: "Overdue",
  NOT_CALIBRATED: "Not calibrated",
};

const CLASS: Record<CalibrationStatus, string> = {
  VALID: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  DUE_SOON: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  OVERDUE: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  NOT_CALIBRATED: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
};

/** Colour badge for an instrument's computed calibration status. */
export function CalibrationBadge({ status, className }: { status: CalibrationStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-0", CLASS[status], className)} data-status={status}>
      {LABEL[status]}
    </Badge>
  );
}
