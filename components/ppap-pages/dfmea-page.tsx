import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, ApplicabilityBadge } from "@/components/status-badge";
import { SignatureBlock } from "@/components/signature-block";
import { NaToggle } from "@/components/na-toggle";
import { DfmeaHeaderForm } from "@/components/ppap-pages/dfmea-header-form";
import { DfmeaGrid } from "@/components/ppap-pages/dfmea-grid";
import { DfmeaOpenActions } from "@/components/ppap-pages/dfmea-open-actions";

export async function DfmeaPage({ ppapId }: { ppapId: string }) {
  const ppap = await prisma.ppap.findUniqueOrThrow({
    where: { id: ppapId },
    include: { customer: true, partRevision: { include: { part: true } } },
  });

  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { ppapId_elementNo: { ppapId, elementNo: 4 } },
    include: {
      dfmeaDetail: {
        include: { rows: { include: { responsible: true }, orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  const users = await prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  const locked = element.status === "APPROVED";
  const rows = element.dfmeaDetail?.rows ?? [];

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>4. DFMEA</CardTitle>
          <div className="flex items-center gap-2">
            <ApplicabilityBadge applicability={element.applicability} />
            <StatusBadge status={element.status} />
            <Button
              render={<Link href={`/ppap/${ppapId}/4/print`} target="_blank" />}
              nativeButton={false}
              variant="outline"
              size="sm"
            >
              Print
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <NaToggle
            ppapElementId={element.id}
            label="Customer design — not in our scope"
            defaultReason="Design Not In Our Scope"
            initialEnabled={element.applicability === "NA"}
            initialReason={element.naReason ?? "Design Not In Our Scope"}
            locked={locked}
          />

          {element.applicability !== "NA" ? (
            <>
              <DfmeaHeaderForm
                ppapElementId={element.id}
                locked={locked}
                master={{
                  customerName: ppap.customer.name,
                  supplierName: "Ingenious Engineering Pvt Ltd",
                  partName: ppap.partRevision.part.partName,
                  partNumber: ppap.partRevision.part.partNumber,
                  project: ppap.partRevision.part.projectModel ?? "",
                }}
                detail={
                  element.dfmeaDetail
                    ? {
                        dfmeaRef: element.dfmeaDetail.dfmeaRef,
                        startDate: element.dfmeaDetail.startDate,
                        revision: element.dfmeaDetail.revision,
                        teamMemberIds: element.dfmeaDetail.teamMemberIds,
                        designResponsibility: element.dfmeaDetail.designResponsibility,
                      }
                    : null
                }
                users={users}
              />

              <DfmeaGrid ppapElementId={element.id} locked={locked} rows={rows} users={users} />

              <DfmeaOpenActions rows={rows} />
            </>
          ) : null}

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
