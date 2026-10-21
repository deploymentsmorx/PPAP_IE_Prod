import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PPAP_ELEMENT_NAMES } from "@/lib/constants/ppap-elements";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, ApplicabilityBadge } from "@/components/status-badge";
import { SignatureBlock } from "@/components/signature-block";
import { ChecklistForm } from "@/components/ppap-pages/checklist-form";

const CHECKLIST_ELEMENT_NUMBERS = Array.from({ length: 18 }, (_, i) => i + 1);

export async function ChecklistPage({ ppapId }: { ppapId: string }) {
  const element0 = await prisma.ppapElement.findUniqueOrThrow({
    where: { ppapId_elementNo: { ppapId, elementNo: 0 } },
  });

  const users = await prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  const otherElements = await prisma.ppapElement.findMany({
    where: { ppapId, elementNo: { in: CHECKLIST_ELEMENT_NUMBERS } },
    select: { elementNo: true, docNo: true, status: true, applicability: true },
  });
  const byElementNo = new Map(otherElements.map((e) => [e.elementNo, e]));

  const checklistRows = await prisma.checklistRow.findMany({ where: { ppapId } });
  const rowByElementNo = new Map(checklistRows.map((r) => [r.elementNo, r]));

  const requiredCount = otherElements.filter((e) => e.applicability === "REQUIRED").length;
  const approvedCount = otherElements.filter(
    (e) => e.applicability === "REQUIRED" && (e.status === "APPROVED" || e.status === "CUSTOMER_APPROVED"),
  ).length;
  const progressPct = requiredCount > 0 ? Math.round((approvedCount / requiredCount) * 100) : 0;

  const locked = element0.status === "APPROVED";

  const rows = CHECKLIST_ELEMENT_NUMBERS.map((elementNo) => {
    const real = byElementNo.get(elementNo);
    const override = rowByElementNo.get(elementNo);
    return {
      elementNo,
      name: PPAP_ELEMENT_NAMES[elementNo],
      docNo: real?.docNo ?? null,
      requiredOverride: override?.requiredOverride ?? "",
      statusOverride: override?.statusOverride ?? "",
      remarks: override?.remarks ?? "",
      docRefLabel: override?.docRefLabel ?? "",
    };
  });

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>0. PPAP Checklist</CardTitle>
          <div className="flex items-center gap-2">
            <ApplicabilityBadge applicability={element0.applicability} />
            <StatusBadge status={element0.status} />
            <Button
              render={<Link href={`/ppap/${ppapId}/0/print`} target="_blank" />}
              nativeButton={false}
              variant="outline"
              size="sm"
            >
              Print
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Progress (required elements approved)
              </span>
              <span className="font-medium">
                {approvedCount} / {requiredCount} ({progressPct}%)
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <ChecklistForm ppapId={ppapId} locked={locked} rows={rows} />

          <SignatureBlock
            ppapElementId={element0.id}
            stages={["PREPARED", "CHECKED", "APPROVED"]}
            status={element0.status}
            users={users}
            prepared={{ byId: element0.preparedById, at: element0.preparedAt }}
            checked={{ byId: element0.checkedById, at: element0.checkedAt }}
            approved={{ byId: element0.approvedById, at: element0.approvedAt }}
          />
        </CardContent>
      </Card>
    </main>
  );
}
