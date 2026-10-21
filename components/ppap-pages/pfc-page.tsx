import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, ApplicabilityBadge } from "@/components/status-badge";
import { SignatureBlock } from "@/components/signature-block";
import { PfcChildPartsGrid } from "@/components/ppap-pages/pfc-child-parts-grid";
import { PfcFlowChart } from "@/components/ppap-pages/pfc-flow-chart";
import { PfcExcelActions } from "@/components/ppap-pages/pfc-excel-actions";

export async function PfcPage({ ppapId }: { ppapId: string }) {
  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { ppapId_elementNo: { ppapId, elementNo: 5 } },
    include: {
      preparedBy: true,
      checkedBy: true,
      approvedBy: true,
      childParts: {
        orderBy: { sortOrder: "asc" },
        include: { route: { include: { steps: { orderBy: { sequence: "asc" }, include: { operation: true } } } } },
      },
      routes: {
        where: { childPartId: null },
        include: { steps: { orderBy: { sequence: "asc" }, include: { operation: true } } },
      },
    },
  });

  const operations = await prisma.operation.findMany({ orderBy: { sortOrder: "asc" } });
  const users = await prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  const locked = element.status === "APPROVED";
  const mainRoute = element.routes[0] ?? null;

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>5. Process Flow Chart</CardTitle>
          <div className="flex items-center gap-2">
            <ApplicabilityBadge applicability={element.applicability} />
            <StatusBadge status={element.status} />
            <Button
              render={<Link href={`/ppap/${ppapId}/5/print`} target="_blank" />}
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
              <PfcExcelActions ppapElementId={element.id} locked={locked} />

              <section>
                <h3 className="mb-2 text-sm font-semibold">Child Parts (BOM) &amp; Routes</h3>
                <PfcChildPartsGrid
                  ppapElementId={element.id}
                  locked={locked}
                  childParts={element.childParts}
                  operations={operations}
                />
              </section>

              <section>
                <h3 className="mb-2 text-sm font-semibold">Generated Flow Chart</h3>
                <PfcFlowChart childParts={element.childParts} mainRoute={mainRoute} />
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
