import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSpecialCharacteristicsForSpcPicker, getInstrumentsForSpcPicker, getSpcStudyResults } from "@/lib/actions/spc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, ApplicabilityBadge } from "@/components/status-badge";
import { SignatureBlock } from "@/components/signature-block";
import { SpcAddStudy } from "@/components/ppap-pages/spc-add-study";
import { SpcStudyCard } from "@/components/ppap-pages/spc-study-card";

export async function SpcPage({ ppapId }: { ppapId: string }) {
  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { ppapId_elementNo: { ppapId, elementNo: 11 } },
    include: {
      preparedBy: true,
      checkedBy: true,
      approvedBy: true,
      spcStudies: {
        orderBy: { sortOrder: "asc" },
        include: { readings: true, specialCharacteristic: true, instrument: true },
      },
    },
  });

  const users = await prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const characteristics = await getSpecialCharacteristicsForSpcPicker(ppapId);
  const instruments = await getInstrumentsForSpcPicker();
  const results = await Promise.all(element.spcStudies.map((s) => getSpcStudyResults(s.id)));

  const locked = element.status === "APPROVED";

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>11. SPC Results</CardTitle>
          <div className="flex items-center gap-2">
            <ApplicabilityBadge applicability={element.applicability} />
            <StatusBadge status={element.status} />
            <Button
              render={<Link href={`/ppap/${ppapId}/11/print`} target="_blank" />}
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
              {element.spcStudies.map((study, i) => (
                <SpcStudyCard
                  key={study.id}
                  ppapId={ppapId}
                  ppapElementId={element.id}
                  locked={locked}
                  study={study}
                  characteristics={characteristics}
                  instruments={instruments}
                  results={results[i]}
                />
              ))}
              {element.spcStudies.length === 0 ? <p className="text-sm text-muted-foreground">No studies yet.</p> : null}
              {!locked ? <SpcAddStudy ppapElementId={element.id} characteristics={characteristics} instruments={instruments} /> : null}
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
