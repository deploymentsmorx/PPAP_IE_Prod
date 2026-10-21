import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  PREPARED: "Prepared",
  CHECKED: "Checked",
  APPROVED: "Approved",
  SUBMITTED: "Submitted",
  CUSTOMER_APPROVED: "Customer approved",
  CUSTOMER_REJECTED: "Customer rejected",
};

const STATUS_CLASS: Record<string, string> = {
  NOT_STARTED: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  PREPARED: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  CHECKED: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  APPROVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  SUBMITTED: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  CUSTOMER_APPROVED: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  CUSTOMER_REJECTED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn(STATUS_CLASS[status], "border-0", className)}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

const APPLICABILITY_LABEL: Record<string, string> = {
  REQUIRED: "Required",
  RETAIN: "Retain",
  NA: "N/A",
};

const APPLICABILITY_CLASS: Record<string, string> = {
  REQUIRED: "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-200",
  RETAIN: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  NA: "bg-muted text-muted-foreground",
};

export function ApplicabilityBadge({ applicability, className }: { applicability: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn(APPLICABILITY_CLASS[applicability], "border-0", className)}>
      {APPLICABILITY_LABEL[applicability] ?? applicability}
    </Badge>
  );
}
