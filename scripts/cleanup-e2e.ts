import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const customers = await prisma.customer.findMany({ where: { name: { startsWith: "E2E" } } });
  if (customers.length === 0) {
    console.log("No E2E test customers found.");
  }

  // E2E approver logins (scripts/create-e2e-approver.ts) — their audit rows
  // and recorded dispositions go with them.
  const e2eUsers = await prisma.user.findMany({ where: { email: { startsWith: "e2e-" } }, select: { id: true } });
  const e2eUserIds = e2eUsers.map((u) => u.id);
  if (e2eUserIds.length) {
    await prisma.auditLog.deleteMany({ where: { userId: { in: e2eUserIds } } });
    await prisma.customerDisposition.updateMany({ where: { recordedById: { in: e2eUserIds } }, data: { recordedById: null } });
    await prisma.session.deleteMany({ where: { userId: { in: e2eUserIds } } });
    await prisma.account.deleteMany({ where: { userId: { in: e2eUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: e2eUserIds } } });
    console.log(`Cleaned up ${e2eUserIds.length} E2E user(s).`);
  }

  for (const customer of customers) {
    const parts = await prisma.part.findMany({ where: { customerId: customer.id } });
    const partIds = parts.map((p) => p.id);
    // Covers both the revision created with the part and any revision an
    // approved ECN created later (new revisions share the same partId).
    const revisions = await prisma.partRevision.findMany({ where: { partId: { in: partIds } } });
    const revisionIds = revisions.map((r) => r.id);
    const ppaps = await prisma.ppap.findMany({ where: { partRevisionId: { in: revisionIds } } });
    const ppapIds = ppaps.map((p) => p.id);
    const elements = await prisma.ppapElement.findMany({ where: { ppapId: { in: ppapIds } } });
    const elementIds = elements.map((e) => e.id);

    await prisma.auditLog.deleteMany({ where: { ppapId: { in: ppapIds } } });
    await prisma.ecnRecord.deleteMany({ where: { ppapElementId: { in: elementIds } } });
    // Dimensional Report rows can FK-reference a Balloon, so they must be
    // cleared before balloons are deleted below.
    const dimensionalReportDetailsForBalloonFk = await prisma.dimensionalReportDetail.findMany({ where: { ppapElementId: { in: elementIds } } });
    const dimensionalReportDetailIdsForBalloonFk = dimensionalReportDetailsForBalloonFk.map((d) => d.id);
    const dimensionalReportRowsForBalloonFk = await prisma.dimensionalReportRow.findMany({ where: { dimensionalReportDetailId: { in: dimensionalReportDetailIdsForBalloonFk } } });
    const dimensionalReportRowIdsForBalloonFk = dimensionalReportRowsForBalloonFk.map((r) => r.id);
    await prisma.dimensionalReportReading.deleteMany({ where: { dimensionalReportRowId: { in: dimensionalReportRowIdsForBalloonFk } } });
    await prisma.dimensionalReportRow.deleteMany({ where: { dimensionalReportDetailId: { in: dimensionalReportDetailIdsForBalloonFk } } });
    await prisma.dimensionalReportSampleColumn.deleteMany({ where: { dimensionalReportDetailId: { in: dimensionalReportDetailIdsForBalloonFk } } });
    await prisma.dimensionalReportDetail.deleteMany({ where: { ppapElementId: { in: elementIds } } });
    await prisma.balloon.deleteMany({ where: { ppapElementId: { in: elementIds } } });
    // SpcStudy FK-references SpecialCharacteristic, so it must be cleared
    // before special characteristics are deleted below.
    const spcStudies = await prisma.spcStudy.findMany({ where: { ppapElementId: { in: elementIds } } });
    const spcStudyIds = spcStudies.map((s) => s.id);
    await prisma.spcReading.deleteMany({ where: { spcStudyId: { in: spcStudyIds } } });
    await prisma.spcStudy.deleteMany({ where: { ppapElementId: { in: elementIds } } });
    await prisma.specialCharacteristic.deleteMany({ where: { ppapElementId: { in: elementIds } } });
    await prisma.drawingFile.deleteMany({ where: { ppapElementId: { in: elementIds } } });
    await prisma.designRecordDetail.deleteMany({ where: { ppapElementId: { in: elementIds } } });
    await prisma.ceaAttachment.deleteMany({ where: { ppapElementId: { in: elementIds } } });
    await prisma.ceaDetail.deleteMany({ where: { ppapElementId: { in: elementIds } } });
    await prisma.customerDisposition.deleteMany({ where: { ppapElementId: { in: elementIds } } });
    const dfmeaDetails = await prisma.dfmeaDetail.findMany({ where: { ppapElementId: { in: elementIds } } });
    const dfmeaDetailIds = dfmeaDetails.map((d) => d.id);
    await prisma.dfmeaRow.deleteMany({ where: { dfmeaDetailId: { in: dfmeaDetailIds } } });
    await prisma.dfmeaDetail.deleteMany({ where: { ppapElementId: { in: elementIds } } });
    const routes = await prisma.route.findMany({ where: { ppapElementId: { in: elementIds } } });
    const routeIds = routes.map((r) => r.id);
    await prisma.routeStep.deleteMany({ where: { routeId: { in: routeIds } } });
    await prisma.route.deleteMany({ where: { id: { in: routeIds } } });
    await prisma.childPart.deleteMany({ where: { ppapElementId: { in: elementIds }, parentChildPartId: { not: null } } });
    await prisma.childPart.deleteMany({ where: { ppapElementId: { in: elementIds } } });
    const pfmeaSteps = await prisma.pfmeaProcessStep.findMany({ where: { ppapElementId: { in: elementIds } } });
    const pfmeaStepIds = pfmeaSteps.map((s) => s.id);
    await prisma.pfmeaRow.deleteMany({ where: { pfmeaProcessStepId: { in: pfmeaStepIds } } });
    await prisma.pfmeaProcessStep.deleteMany({ where: { ppapElementId: { in: elementIds } } });
    const msaStudies = await prisma.msaStudy.findMany({ where: { ppapElementId: { in: elementIds } } });
    const msaStudyIds = msaStudies.map((s) => s.id);
    await prisma.msaDataPoint.deleteMany({ where: { msaStudyId: { in: msaStudyIds } } });
    await prisma.msaStudy.deleteMany({ where: { ppapElementId: { in: elementIds } } });
    const controlPlanDetails = await prisma.controlPlanDetail.findMany({ where: { ppapElementId: { in: elementIds } } });
    const controlPlanDetailIds = controlPlanDetails.map((d) => d.id);
    await prisma.controlPlanRow.deleteMany({ where: { controlPlanDetailId: { in: controlPlanDetailIds } } });
    await prisma.controlPlanDetail.deleteMany({ where: { ppapElementId: { in: elementIds } } });
    // LabReport FK-references RmtcReportRow, so it must be cleared before
    // RMTC rows are deleted below.
    const labReports = await prisma.labReport.findMany({ where: { ppapElementId: { in: elementIds } } });
    const labReportIds = labReports.map((r) => r.id);
    await prisma.labTestDetail.deleteMany({ where: { labReportId: { in: labReportIds } } });
    await prisma.labMechanicalResult.deleteMany({ where: { labReportId: { in: labReportIds } } });
    await prisma.labChemicalResult.deleteMany({ where: { labReportId: { in: labReportIds } } });
    await prisma.labPaintResult.deleteMany({ where: { labReportId: { in: labReportIds } } });
    await prisma.labReport.deleteMany({ where: { ppapElementId: { in: elementIds } } });
    const aarRows = await prisma.aarCriteriaRow.findMany({ where: { ppapElementId: { in: elementIds } } });
    await prisma.aarPhoto.deleteMany({ where: { aarCriteriaRowId: { in: aarRows.map((r) => r.id) } } });
    await prisma.aarCriteriaRow.deleteMany({ where: { ppapElementId: { in: elementIds } } });
    await prisma.aarDetail.deleteMany({ where: { ppapElementId: { in: elementIds } } });
    await prisma.sppSample.deleteMany({ where: { ppapElementId: { in: elementIds } } });
    await prisma.sppFunctionalTest.deleteMany({ where: { ppapElementId: { in: elementIds } } });
    await prisma.sppPackagingPhoto.deleteMany({ where: { ppapElementId: { in: elementIds } } });
    await prisma.sppDetail.deleteMany({ where: { ppapElementId: { in: elementIds } } });
    const masterSamples = await prisma.masterSample.findMany({ where: { ppapElementId: { in: elementIds } } });
    await prisma.masterSampleImage.deleteMany({ where: { masterSampleId: { in: masterSamples.map((m) => m.id) } } });
    await prisma.masterSample.deleteMany({ where: { ppapElementId: { in: elementIds } } });
    await prisma.ppapCheckingAid.deleteMany({ where: { ppapElementId: { in: elementIds } } });
    await prisma.csrCompliance.deleteMany({ where: { ppapElementId: { in: elementIds } } });
    await prisma.csrZoneMapView.deleteMany({ where: { page: { ppapElementId: { in: elementIds } } } });
    await prisma.csrZoneMapPage.deleteMany({ where: { ppapElementId: { in: elementIds } } });
    await prisma.pswDetail.deleteMany({ where: { ppapElementId: { in: elementIds } } });
    const rmtcDetails = await prisma.rmtcReportDetail.findMany({ where: { ppapElementId: { in: elementIds } } });
    const rmtcDetailIds = rmtcDetails.map((d) => d.id);
    await prisma.rmtcReportRow.deleteMany({ where: { rmtcReportDetailId: { in: rmtcDetailIds } } });
    await prisma.rmtcReportDetail.deleteMany({ where: { ppapElementId: { in: elementIds } } });
    await prisma.checklistRow.deleteMany({ where: { ppapId: { in: ppapIds } } });
    await prisma.ppapElement.deleteMany({ where: { ppapId: { in: ppapIds } } });
    await prisma.ppap.deleteMany({ where: { id: { in: ppapIds } } });
    await prisma.partRevision.deleteMany({ where: { id: { in: revisionIds } } });
    await prisma.part.deleteMany({ where: { id: { in: partIds } } });
    const csrSections = await prisma.csrSection.findMany({ where: { customerId: customer.id }, select: { id: true } });
    await prisma.csrCompliance.deleteMany({ where: { requirement: { sectionId: { in: csrSections.map((s) => s.id) } } } });
    await prisma.csrRequirement.deleteMany({ where: { sectionId: { in: csrSections.map((s) => s.id) } } });
    await prisma.csrSection.deleteMany({ where: { customerId: customer.id } });
    await prisma.customer.delete({ where: { id: customer.id } });

    console.log(
      `Cleaned up E2E customer "${customer.name}" (${ppaps.length} PPAP(s), ${revisions.length} revision(s)).`,
    );
  }

  // E2E labs (e2e/lab-master.spec.ts) — after the loop, since lab reports
  // that reference them are deleted with their customer's PPAPs above.
  const labs = await prisma.labMaster.findMany({ where: { name: { startsWith: "E2E" } } });
  const labIds = labs.map((l) => l.id);
  await prisma.auditLog.deleteMany({ where: { entityType: "LabMaster", entityId: { in: labIds } } });
  await prisma.labMaster.deleteMany({ where: { id: { in: labIds } } });
  if (labs.length > 0) console.log(`Cleaned up ${labs.length} E2E lab(s).`);

  // E2E instruments / fixtures (e2e/checking-aids.spec.ts) — after the
  // loop, since PPAP rows referencing them were deleted above.
  const instruments = await prisma.instrument.findMany({ where: { description: { startsWith: "E2E" } } });
  const instrumentIds = instruments.map((i) => i.id);
  await prisma.calibrationRecord.deleteMany({ where: { instrumentId: { in: instrumentIds } } });
  await prisma.ppapCheckingAid.deleteMany({ where: { instrumentId: { in: instrumentIds } } });
  await prisma.auditLog.deleteMany({ where: { entityType: { in: ["Instrument", "CalibrationRecord"] }, entityId: { in: instrumentIds } } });
  await prisma.instrument.deleteMany({ where: { id: { in: instrumentIds } } });
  const fixtures = await prisma.fixture.deleteMany({ where: { code: { startsWith: "E2E" } } });
  if (instruments.length + fixtures.count > 0) console.log(`Cleaned up ${instruments.length} E2E instrument(s), ${fixtures.count} fixture(s).`);
}

main().finally(() => prisma.$disconnect());
