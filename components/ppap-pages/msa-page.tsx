import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getInstrumentsForGaugePicker, getControlPlanRowsForCharacteristicPicker, getStudyResults } from "@/lib/actions/msa";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, ApplicabilityBadge } from "@/components/status-badge";
import { SignatureBlock } from "@/components/signature-block";
import { MsaAddStudy } from "@/components/ppap-pages/msa-add-study";
import { MsaStudyCard } from "@/components/ppap-pages/msa-study-card";

export async function MsaPage({ ppapId }: { ppapId: string }) {
  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { ppapId_elementNo: { ppapId, elementNo: 8 } },
    include: {
      preparedBy: true,
      checkedBy: true,
      approvedBy: true,
      msaStudies: {
        orderBy: { sortOrder: "asc" },
        include: { dataPoints: true, gauge: true, controlPlanRow: true },
      },
    },
  });

  const users = await prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const instruments = await getInstrumentsForGaugePicker();
  const controlPlanRows = await getControlPlanRowsForCharacteristicPicker(ppapId);
  const results = await Promise.all(element.msaStudies.map((s) => getStudyResults(s.id)));

  const locked = element.status === "APPROVED";

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>8. MSA</CardTitle>
          <div className="flex items-center gap-2">
            <ApplicabilityBadge applicability={element.applicability} />
            <StatusBadge status={element.status} />
            <Button
              render={<Link href={`/ppap/${ppapId}/8/print`} target="_blank" />}
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
              {element.msaStudies.map((study, i) => (
                <MsaStudyCard
                  key={study.id}
                  ppapId={ppapId}
                  ppapElementId={element.id}
                  locked={locked}
                  study={study}
                  instruments={instruments}
                  controlPlanRows={controlPlanRows}
                  complete={results[i].complete}
                  filled={results[i].filled}
                  expected={results[i].expected}
                  result={results[i].result}
                />
              ))}
              {element.msaStudies.length === 0 ? (
                <p className="text-sm text-muted-foreground">No studies yet.</p>
              ) : null}
              {!locked ? (
                <MsaAddStudy ppapElementId={element.id} instruments={instruments} controlPlanRows={controlPlanRows} />
              ) : null}
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
