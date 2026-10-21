"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PPAP_ELEMENT_NUMBERS, PPAP_ELEMENT_NAMES } from "@/lib/constants/ppap-elements";
import { StatusBadge, ApplicabilityBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type NavElement = {
  elementNo: number;
  status: string;
  applicability: string;
  revisionRequired: boolean;
};

const DONE = new Set(["APPROVED", "SUBMITTED", "CUSTOMER_APPROVED"]);

// Left rail colour per status, so the list reads at a glance.
const RAIL: Record<string, string> = {
  NOT_STARTED: "bg-transparent",
  IN_PROGRESS: "bg-blue-400",
  PREPARED: "bg-amber-400",
  CHECKED: "bg-indigo-400",
  APPROVED: "bg-emerald-500",
  SUBMITTED: "bg-sky-500",
  CUSTOMER_APPROVED: "bg-green-600",
  CUSTOMER_REJECTED: "bg-red-500",
};

export function PpapNav({ ppapId, elements }: { ppapId: string; elements: NavElement[] }) {
  const pathname = usePathname();
  const activeElementNo = Number(pathname.match(/^\/ppap\/[^/]+\/(\d+)/)?.[1] ?? NaN);
  const byNo = new Map(elements.map((e) => [e.elementNo, e]));
  const applicable = elements.filter((e) => e.applicability !== "NA");
  const done = applicable.filter((e) => DONE.has(e.status)).length;
  const pct = applicable.length ? Math.round((done / applicable.length) * 100) : 0;

  return (
    <nav aria-label="PPAP elements" className="sticky top-14 hidden h-[calc(100svh-3.5rem)] w-76 shrink-0 flex-col border-r bg-sidebar md:flex">
      <div className="border-b px-4 py-3">
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-semibold tracking-wide text-muted-foreground uppercase">Elements</span>
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">{done}</span> / {applicable.length} approved
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <ul className="flex-1 overflow-y-auto py-1.5">
        {PPAP_ELEMENT_NUMBERS.map((elementNo) => {
          const el = byNo.get(elementNo);
          const isActive = elementNo === activeElementNo;
          return (
            <li key={elementNo} className="px-2">
              <Link
                href={`/ppap/${ppapId}/${elementNo}`}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex flex-col gap-1 rounded-md py-2 pr-2 pl-4 text-sm hover:bg-muted",
                  isActive && "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent",
                  el?.applicability === "NA" && !isActive && "opacity-60",
                )}
              >
                <span aria-hidden className={cn("absolute top-2 bottom-2 left-1 w-[3px] rounded-full", RAIL[el?.status ?? "NOT_STARTED"])} />
                <span className={cn("leading-snug", isActive ? "font-semibold" : "font-medium")}>
                  {elementNo}. {PPAP_ELEMENT_NAMES[elementNo]}
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {el ? <ApplicabilityBadge applicability={el.applicability} className="h-[18px] px-1.5 text-[0.68rem]" /> : null}
                  {el ? <StatusBadge status={el.status} className="h-[18px] px-1.5 text-[0.68rem]" /> : null}
                  {el?.revisionRequired ? (
                    <Badge variant="destructive" className="h-[18px] px-1.5 text-[0.68rem]">
                      Revision required
                    </Badge>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
