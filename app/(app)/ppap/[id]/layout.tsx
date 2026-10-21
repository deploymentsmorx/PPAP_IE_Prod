import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, CircleCheck, CircleDot, Copy, FileStack, History, Send, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PpapNav } from "@/components/ppap-nav";
import { ApprovalModeControl } from "@/components/approval-mode-control";
import { buttonVariants } from "@/components/ui/button";
import { formatDateIndia } from "@/lib/format";
import { assertCanViewPpap, getCurrentUser } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const STATUS = {
  OPEN: { label: "Open", icon: CircleDot, className: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-900" },
  SUBMITTED: { label: "Submitted", icon: Send, className: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900" },
  CLOSED: { label: "Closed", icon: CircleCheck, className: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900" },
} as const;

export default async function PpapLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ppap = await prisma.ppap.findUnique({
    where: { id },
    include: {
      customer: true,
      partRevision: { include: { part: true } },
      elements: { select: { elementNo: true, status: true, applicability: true, revisionRequired: true } },
    },
  });

  if (!ppap) {
    notFound();
  }
  // Customer logins see only their own customer's PPAPs.
  await assertCanViewPpap(ppap.customerId);
  const user = await getCurrentUser();
  const status = STATUS[ppap.status];
  const action = cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5");
  const part = ppap.partRevision.part;

  return (
    <div className="flex min-h-[calc(100svh-3.5rem)]">
      <PpapNav ppapId={ppap.id} elements={ppap.elements} />
      <div className="min-w-0 flex-1">
        <div className="border-b bg-card px-6 pt-3 pb-4">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              Dashboard
            </Link>
            <ChevronRight className="size-3" aria-hidden />
            <span>{ppap.customer.name}</span>
            <ChevronRight className="size-3" aria-hidden />
            <span className="text-foreground">
              {part.partNumber} Rev.{ppap.partRevision.revision}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="truncate text-lg font-semibold tracking-tight">{part.partName}</h1>
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", status.className)}>
                  <status.icon className="size-3" aria-hidden />
                  <span data-testid="ppap-status">{status.label}</span>
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <span>
                  <span className="font-medium text-foreground">{part.partNumber}</span> Rev.{ppap.partRevision.revision}
                </span>
                <span aria-hidden>·</span>
                <span>{ppap.customer.name}</span>
                <span aria-hidden>·</span>
                <span>Level {ppap.level}</span>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1.5">
                  Customer approval: <ApprovalModeControl ppapId={ppap.id} initialMode={ppap.approvalMode} />
                </span>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link href={`/ppap/${ppap.id}/pack`} className={action}>
                <FileStack className="size-3.5" aria-hidden />
                Final PPAP &amp; pack
              </Link>
              {user?.can.editSupplierData ? (
                <Link href={`/ppap/${ppap.id}/clone`} className={action}>
                  <Copy className="size-3.5" aria-hidden />
                  Clone PPAP
                </Link>
              ) : null}
              {user?.can.viewAuditLog ? (
                <Link href={`/audit?ppap=${ppap.id}`} className={action}>
                  <History className="size-3.5" aria-hidden />
                  Audit log
                </Link>
              ) : null}
            </div>
          </div>
        </div>
        {ppap.status === "CLOSED" ? (
          <div className="flex items-center gap-2 border-b border-emerald-200 bg-emerald-50 px-6 py-2.5 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" data-testid="ppap-closed-banner">
            <CircleCheck className="size-4 shrink-0" aria-hidden />
            <span>
              PPAP closed — the customer approved the PSW{ppap.statusChangedAt ? ` on ${formatDateIndia(ppap.statusChangedAt)}` : ""}. Sign-offs and revisions are
              locked.
            </span>
          </div>
        ) : null}
        {ppap.status === "OPEN" && ppap.lastRejectionComments ? (
          <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-6 py-2.5 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200" data-testid="ppap-rejected-banner">
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            <span>PSW rejected by the customer — PPAP re-opened for revision: {ppap.lastRejectionComments}</span>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
