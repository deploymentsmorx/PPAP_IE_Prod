import Link from "next/link";
import { PPAP_ELEMENT_NAMES } from "@/lib/constants/ppap-elements";
import { summarize, type Issue } from "@/lib/calc/consistency";

/** Pre-submission data-consistency results (lib/consistency.ts). Errors block the PSW signature. */
export function ConsistencyPanel({ ppapId, issues }: { ppapId: string; issues: Issue[] }) {
  const { errors, warnings } = summarize(issues);
  return (
    <section className="space-y-2 rounded-md border p-3 text-sm" data-testid="consistency-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">Pre-submission data checks</h3>
        <span data-testid="consistency-summary" className={errors ? "font-medium text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}>
          {errors} error(s), {warnings} warning(s){errors ? " — errors block signing" : ""}
        </span>
      </div>
      {issues.length === 0 ? (
        <p className="text-muted-foreground">Date order, part-revision ownership, checklist applicability and typed-vs-computed values all check out.</p>
      ) : (
        <ul className="space-y-1">
          {issues.map((i, n) => (
            <li key={n} className="flex gap-2" data-severity={i.severity}>
              <span className={i.severity === "ERROR" ? "w-16 shrink-0 font-semibold text-red-700 dark:text-red-400" : "w-16 shrink-0 text-amber-700 dark:text-amber-400"}>
                {i.severity === "ERROR" ? "Error" : "Warning"}
              </span>
              <span className="w-36 shrink-0 text-muted-foreground">{i.check}</span>
              <span>
                {i.elementNo !== null ? (
                  <Link href={`/ppap/${ppapId}/${i.elementNo}`} className="text-primary hover:underline">
                    {i.elementNo}. {PPAP_ELEMENT_NAMES[i.elementNo]}
                  </Link>
                ) : null}{" "}
                — {i.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
