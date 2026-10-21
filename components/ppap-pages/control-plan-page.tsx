import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getInstrumentsForPicker, getSpecialCharacteristicsForPicker } from "@/lib/actions/control-plan";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, ApplicabilityBadge } from "@/components/status-badge";
import { SignatureBlock } from "@/components/signature-block";
import { ControlPlanHeaderForm } from "@/components/ppap-pages/control-plan-header-form";
import { ControlPlanGrid } from "@/components/ppap-pages/control-plan-grid";
import { ControlPlanConsistencyPanel } from "@/components/ppap-pages/control-plan-consistency-panel";

export async function ControlPlanPage({ ppapId }: { ppapId: string }) {
  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { ppapId_elementNo: { ppapId, elementNo: 7 } },
    include: {
      preparedBy: true,
      checkedBy: true,
      approvedBy: true,
      controlPlanDetail: {
        include: { rows: { orderBy: { sortOrder: "asc" }, include: { instrument: true, specialCharacteristic: true } } },
      },
    },
  });

  const users = await prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const instruments = await getInstrumentsForPicker();
  const specialChars = await getSpecialCharacteristicsForPicker(ppapId);

  const locked = element.status === "APPROVED";
  const rows = element.controlPlanDetail?.rows ?? [];

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>7. Control Plan</CardTitle>
          <div className="flex items-center gap-2">
            <ApplicabilityBadge applicability={element.applicability} />
            <StatusBadge status={element.status} />
            <Button
              render={<Link href={`/ppap/${ppapId}/7/print`} target="_blank" />}
              nativeButton={false}
              variant="outline"
              size="sm"
            >
              Print
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {element.applicability === "NA" ? (
            <p className="rounded bg-muted px-3 py-2 text-sm text-muted-foreground">N/A — {element.naReason}</p>
          ) : (
            <>
              <ControlPlanHeaderForm ppapElementId={element.id} locked={locked} detail={element.controlPlanDetail} />

              <ControlPlanConsistencyPanel ppapElementId={element.id} />

              <section>
                <h3 className="mb-2 text-sm font-semibold">Control Plan Rows</h3>
                <ControlPlanGrid
                  ppapElementId={element.id}
                  locked={locked}
                  rows={rows}
                  instruments={instruments}
                  specialChars={specialChars}
                />
              </section>
            </>
          )}

          <SignatureBlock
            ppapElementId={element.id}
            stages={["PREPARED", "CHECKED", "APPROVED"]}
            status={element.status}
            users={users}
            prepared={{ byId: element.preparedById, at: element.preparedAt }}
            checked={{ byId: element.checkedById, at: element.checkedAt }}
            approved={{ byId: element.approvedById, at: element.approvedAt }}
          />
        </CardContent>
      </Card>
    </main>
  );
}
