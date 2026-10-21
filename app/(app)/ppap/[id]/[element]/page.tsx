import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PPAP_ELEMENT_NUMBERS } from "@/lib/constants/ppap-elements";
import { GenericElementPlaceholder } from "@/components/ppap-pages/generic-element-placeholder";
import { DesignRecordPage } from "@/components/ppap-pages/design-record-page";
import { ChecklistPage } from "@/components/ppap-pages/checklist-page";
import { EcnRecordPage } from "@/components/ppap-pages/ecn-record-page";
import { CeaPage } from "@/components/ppap-pages/cea-page";
import { DfmeaPage } from "@/components/ppap-pages/dfmea-page";
import { PfcPage } from "@/components/ppap-pages/pfc-page";
import { PfmeaPage } from "@/components/ppap-pages/pfmea-page";
import { ControlPlanPage } from "@/components/ppap-pages/control-plan-page";
import { MsaPage } from "@/components/ppap-pages/msa-page";
import { DimensionalReportPage } from "@/components/ppap-pages/dimensional-report-page";
import { RmtcPage } from "@/components/ppap-pages/rmtc-page";
import { SpcPage } from "@/components/ppap-pages/spc-page";
import { LabPage } from "@/components/ppap-pages/lab-page";
import { AarPage } from "@/components/ppap-pages/aar-page";
import { SppPage } from "@/components/ppap-pages/spp-page";
import { MasterSamplePage } from "@/components/ppap-pages/master-sample-page";
import { CheckingAidsPage } from "@/components/ppap-pages/checking-aids-page";
import { CsrPage } from "@/components/ppap-pages/csr-page";
import { PswPage } from "@/components/ppap-pages/psw-page";

export default async function PpapElementPage({
  params,
}: {
  params: Promise<{ id: string; element: string }>;
}) {
  const { id, element } = await params;
  const elementNo = Number(element);

  if (!Number.isInteger(elementNo) || !PPAP_ELEMENT_NUMBERS.includes(elementNo)) {
    notFound();
  }

  if (elementNo === 0) {
    return <ChecklistPage ppapId={id} />;
  }

  if (elementNo === 1) {
    return <DesignRecordPage ppapId={id} />;
  }

  if (elementNo === 2) {
    return <EcnRecordPage ppapId={id} />;
  }

  if (elementNo === 3) {
    return <CeaPage ppapId={id} />;
  }

  if (elementNo === 4) {
    return <DfmeaPage ppapId={id} />;
  }

  if (elementNo === 5) {
    return <PfcPage ppapId={id} />;
  }

  if (elementNo === 6) {
    return <PfmeaPage ppapId={id} />;
  }

  if (elementNo === 7) {
    return <ControlPlanPage ppapId={id} />;
  }

  if (elementNo === 8) {
    return <MsaPage ppapId={id} />;
  }

  if (elementNo === 9) {
    return <DimensionalReportPage ppapId={id} />;
  }

  if (elementNo === 10) {
    return <RmtcPage ppapId={id} />;
  }

  if (elementNo === 11) {
    return <SpcPage ppapId={id} />;
  }

  if (elementNo === 12) {
    return <LabPage ppapId={id} />;
  }

  if (elementNo === 13) {
    return <AarPage ppapId={id} />;
  }

  if (elementNo === 14) {
    return <SppPage ppapId={id} />;
  }

  if (elementNo === 15) {
    return <MasterSamplePage ppapId={id} />;
  }

  if (elementNo === 16) {
    return <CheckingAidsPage ppapId={id} />;
  }

  if (elementNo === 17) {
    return <CsrPage ppapId={id} />;
  }

  if (elementNo === 18) {
    return <PswPage ppapId={id} />;
  }

  const ppapElement = await prisma.ppapElement.findUnique({
    where: { ppapId_elementNo: { ppapId: id, elementNo } },
    include: { preparedBy: true, checkedBy: true, approvedBy: true },
  });

  if (!ppapElement) {
    notFound();
  }

  return <GenericElementPlaceholder ppapElement={ppapElement} />;
}
