import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getInstrumentsForDimensionalReportPicker, getConformanceSummary } from "@/lib/actions/dimensional-report";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, ApplicabilityBadge } from "@/components/status-badge";
import { SignatureBlock } from "@/components/signature-block";
import { DimensionalReportHeaderForm } from "@/components/ppap-pages/dimensional-report-header-form";
import { DimensionalReportActions } from "@/components/ppap-pages/dimensional-report-actions";
import { DimensionalReportGrid } from "@/components/ppap-pages/dimensional-report-grid";
import { DimensionalReportSummaryPanel } from "@/components/ppap-pages/dimensional-report-summary-panel";

export async function DimensionalReportPage({ ppapId }: { ppapId: string }) {
  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { ppapId_elementNo: { ppapId, elementNo: 9 } },
    include: {
      preparedBy: true,
      checkedBy: true,
      approvedBy: true,
      ppap: { include: { customer: true, partRevision: { include: { part: true } } } },
      dimensionalReportDetail: {
        include: {
          sampleColumns: { orderBy: { sortOrder: "asc" } },
          rows: { orderBy: { sortOrder: "asc" }, include: { readings: true, instrument: true } },
        },
      },
    },
  });

  const users = await prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const instruments = await getInstrumentsForDimensionalReportPicker();
  const summary = await getConformanceSummary(element.id);

  const locked = element.status === "APPROVED";
  const detail = element.dimensionalReportDetail;
  const rows = detail?.rows ?? [];
  const sampleColumns = detail?.sampleColumns ?? [];

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>9. Dimensional Report</CardTitle>
          <div className="flex items-center gap-2">
            <ApplicabilityBadge applicability={element.applicability} />
            <StatusBadge status={element.status} />
            <Button
              render={<Link href={`/ppap/${ppapId}/9/print`} target="_blank" />}
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
              <DimensionalReportHeaderForm
                ppapElementId={element.id}
                locked={locked}
                detail={detail}
                master={{
                  customerName: element.ppap.customer.name,
                  drawingNumber: `${element.ppap.partRevision.drawingNo ?? element.ppap.partRevision.part.partNumber} Rev ${element.ppap.partRevision.revision}`,
                  partName: element.ppap.partRevision.part.partName,
                }}
              />

              <DimensionalReportActions ppapElementId={element.id} locked={locked} sampleColumns={sampleColumns} />

              <DimensionalReportSummaryPanel
                ppapId={ppapId}
                total={summary.total}
                checked={summary.checked}
                ok={summary.ok}
                ng={summary.ng}
                pctConformance={summary.pctConformance}
                ngRows={summary.ngRows}
              />

              <DimensionalReportGrid
                ppapElementId={element.id}
                locked={locked}
                rows={rows}
                instruments={instruments}
                sampleColumns={sampleColumns}
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
