import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getProcessStepList } from "@/lib/actions/pfc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, ApplicabilityBadge } from "@/components/status-badge";
import { SignatureBlock } from "@/components/signature-block";
import { PfmeaGrid } from "@/components/ppap-pages/pfmea-grid";
import { PfmeaExcelActions } from "@/components/ppap-pages/pfmea-excel-actions";

export async function PfmeaPage({ ppapId }: { ppapId: string }) {
  const ppap = await prisma.ppap.findUniqueOrThrow({
    where: { id: ppapId },
    include: { partRevision: { include: { part: true } } },
  });

  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { ppapId_elementNo: { ppapId, elementNo: 6 } },
    include: {
      preparedBy: true,
      checkedBy: true,
      approvedBy: true,
      pfmeaProcessSteps: {
        orderBy: { sortOrder: "asc" },
        include: { rows: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  const pfcElement = await prisma.ppapElement.findUnique({
    where: { ppapId_elementNo: { ppapId, elementNo: 5 } },
  });
  const pfcSteps = pfcElement ? await getProcessStepList(pfcElement.id) : [];

  const operations = await prisma.operation.findMany({ orderBy: { sortOrder: "asc" } });
  const users = await prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  const locked = element.status === "APPROVED";

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>6. PFMEA</CardTitle>
          <div className="flex items-center gap-2">
            <ApplicabilityBadge applicability={element.applicability} />
            <StatusBadge status={element.status} />
            <Button
              render={<Link href={`/ppap/${ppapId}/6/print`} target="_blank" />}
              nativeButton={false}
              variant="outline"
              size="sm"
            >
              Print
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {element.applicability === "NA" ? (
            <p className="rounded bg-muted px-3 py-2 text-sm text-muted-foreground">N/A — {element.naReason}</p>
          ) : (
            <>
              <section className="space-y-2 rounded-md border p-3 text-sm">
                <h3 className="font-semibold">PFMEA – General Process – {ppap.partRevision.part.partName}</h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                  <dt className="text-muted-foreground">Doc No.</dt>
                  <dd>{element.docNo ?? "—"}</dd>
                  <dt className="text-muted-foreground">Revision</dt>
                  <dd>{element.revision}</dd>
                </dl>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    PFC Reference ({pfcSteps.length} step{pfcSteps.length === 1 ? "" : "s"}):
                  </p>
                  <p className="text-xs">
                    {pfcSteps.length > 0
                      ? pfcSteps.map((s, i) => `${i + 1}. ${s.operationName}`).join("  ")
                      : "No Process Flow Chart steps found yet — build element 5 first."}
                  </p>
                </div>
              </section>

              <PfmeaExcelActions ppapElementId={element.id} locked={locked} />

              <PfmeaGrid
                ppapElementId={element.id}
                locked={locked}
                steps={element.pfmeaProcessSteps}
                users={users}
                operations={operations}
              />
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
