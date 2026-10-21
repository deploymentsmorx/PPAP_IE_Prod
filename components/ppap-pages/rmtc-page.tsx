import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getMaterialSpecsForPicker } from "@/lib/actions/rmtc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, ApplicabilityBadge } from "@/components/status-badge";
import { SignatureBlock } from "@/components/signature-block";
import { RmtcHeaderForm } from "@/components/ppap-pages/rmtc-header-form";
import { RmtcActions } from "@/components/ppap-pages/rmtc-actions";
import { RmtcGrid } from "@/components/ppap-pages/rmtc-grid";
import { RmtcHeatSearch } from "@/components/ppap-pages/rmtc-heat-search";

export async function RmtcPage({ ppapId }: { ppapId: string }) {
  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { ppapId_elementNo: { ppapId, elementNo: 10 } },
    include: {
      preparedBy: true,
      checkedBy: true,
      approvedBy: true,
      ppap: { include: { customer: true, partRevision: { include: { part: true } } } },
      // No materialSpec relation here — RmtcGrid is a client component and
      // only needs materialSpecId; MaterialSpec carries Decimal fields that
      // can't cross the server/client boundary as props.
      rmtcReportDetail: {
        include: { rows: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  const users = await prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const materialSpecs = await getMaterialSpecsForPicker();

  const locked = element.status === "APPROVED";
  const detail = element.rmtcReportDetail;
  const rows = detail?.rows ?? [];
  const tolerance = {
    thicknessMm: detail?.thicknessToleranceMm != null ? Number(detail.thicknessToleranceMm) : 0.3,
    widthMm: detail?.widthToleranceMm != null ? Number(detail.widthToleranceMm) : 30,
    lengthMm: detail?.lengthToleranceMm != null ? Number(detail.lengthToleranceMm) : 30,
  };
  // Decimal fields can't cross the server/client boundary as props — only
  // pass the plain-number form down to the (client) header form.
  const detailForForm = detail
    ? {
        projectName: detail.projectName,
        otherRef: detail.otherRef,
        codeNo: detail.codeNo,
        supplierName: detail.supplierName,
        thicknessToleranceMm: tolerance.thicknessMm,
        widthToleranceMm: tolerance.widthMm,
        lengthToleranceMm: tolerance.lengthMm,
        reportRemarks: detail.reportRemarks,
        customerWitnessName: detail.customerWitnessName,
        customerWitnessAt: detail.customerWitnessAt,
      }
    : null;

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>10. Material / Performance Test Results (RM Test Reports)</CardTitle>
          <div className="flex items-center gap-2">
            <ApplicabilityBadge applicability={element.applicability} />
            <StatusBadge status={element.status} />
            <Button
              render={<Link href={`/ppap/${ppapId}/10/print`} target="_blank" />}
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
              <RmtcHeaderForm
                ppapElementId={element.id}
                locked={locked}
                detail={detailForForm}
                master={{
                  customerName: element.ppap.customer.name,
                  partName: element.ppap.partRevision.part.partName,
                  partNumber: element.ppap.partRevision.part.partNumber,
                  drawingRevNo: `Revision - ${element.ppap.partRevision.revision}`,
                }}
              />

              <RmtcActions ppapElementId={element.id} locked={locked} />

              <RmtcGrid
                ppapId={ppapId}
                ppapElementId={element.id}
                locked={locked}
                rows={rows}
                materialSpecs={materialSpecs}
                tolerance={tolerance}
              />

              <RmtcHeatSearch />
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
