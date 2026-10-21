import { notFound } from "next/navigation";
import { PPAP_ELEMENT_NUMBERS } from "@/lib/constants/ppap-elements";
import { prisma } from "@/lib/prisma";
import { assertCanViewPpap } from "@/lib/permissions";
import { DesignRecordPrint } from "@/components/ppap-pages/design-record-print";
import { ChecklistPrint } from "@/components/ppap-pages/checklist-print";
import { EcnPrint } from "@/components/ppap-pages/ecn-print";
import { CeaPrint } from "@/components/ppap-pages/cea-print";
import { DfmeaPrint } from "@/components/ppap-pages/dfmea-print";
import { PfcPrint } from "@/components/ppap-pages/pfc-print";
import { PfmeaPrint } from "@/components/ppap-pages/pfmea-print";
import { ControlPlanPrint } from "@/components/ppap-pages/control-plan-print";
import { MsaPrint } from "@/components/ppap-pages/msa-print";
import { DimensionalReportPrint } from "@/components/ppap-pages/dimensional-report-print";
import { RmtcPrint } from "@/components/ppap-pages/rmtc-print";
import { SpcPrint } from "@/components/ppap-pages/spc-print";
import { LabPrint } from "@/components/ppap-pages/lab-print";
import { AarPrint } from "@/components/ppap-pages/aar-print";
import { SppPrint } from "@/components/ppap-pages/spp-print";
import { MasterSamplePrint } from "@/components/ppap-pages/master-sample-print";
import { CheckingAidsPrint } from "@/components/ppap-pages/checking-aids-print";
import { CsrPrint } from "@/components/ppap-pages/csr-print";
import { PswPrint } from "@/components/ppap-pages/psw-print";

export default async function PpapElementPrintPage({
  params,
}: {
  params: Promise<{ id: string; element: string }>;
}) {
  const { id, element } = await params;
  const elementNo = Number(element);

  if (!Number.isInteger(elementNo) || !PPAP_ELEMENT_NUMBERS.includes(elementNo)) {
    notFound();
  }
  const ppap = await prisma.ppap.findUnique({ where: { id }, select: { customerId: true } });
  if (!ppap) notFound();
  await assertCanViewPpap(ppap.customerId);

  if (elementNo === 0) {
    return <ChecklistPrint ppapId={id} />;
  }

  if (elementNo === 1) {
    return <DesignRecordPrint ppapId={id} />;
  }

  if (elementNo === 2) {
    return <EcnPrint ppapId={id} />;
  }

  if (elementNo === 3) {
    return <CeaPrint ppapId={id} />;
  }

  if (elementNo === 4) {
    return <DfmeaPrint ppapId={id} />;
  }

  if (elementNo === 5) {
    return <PfcPrint ppapId={id} />;
  }

  if (elementNo === 6) {
    return <PfmeaPrint ppapId={id} />;
  }

  if (elementNo === 7) {
    return <ControlPlanPrint ppapId={id} />;
  }

  if (elementNo === 8) {
    return <MsaPrint ppapId={id} />;
  }

  if (elementNo === 9) {
    return <DimensionalReportPrint ppapId={id} />;
  }

  if (elementNo === 10) {
    return <RmtcPrint ppapId={id} />;
  }

  if (elementNo === 11) {
    return <SpcPrint ppapId={id} />;
  }

  if (elementNo === 12) {
    return <LabPrint ppapId={id} />;
  }

  if (elementNo === 13) {
    return <AarPrint ppapId={id} />;
  }

  if (elementNo === 14) {
    return <SppPrint ppapId={id} />;
  }

  if (elementNo === 15) {
    return <MasterSamplePrint ppapId={id} />;
  }

  if (elementNo === 16) {
    return <CheckingAidsPrint ppapId={id} />;
  }

  if (elementNo === 17) {
    return <CsrPrint ppapId={id} />;
  }

  if (elementNo === 18) {
    return <PswPrint ppapId={id} />;
  }

  return (
    <div className="p-6 text-sm text-muted-foreground">
      The print view for this element has not been built yet.
    </div>
  );
}
