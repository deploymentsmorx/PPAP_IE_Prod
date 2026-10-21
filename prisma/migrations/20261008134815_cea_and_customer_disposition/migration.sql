-- CreateEnum
CREATE TYPE "CeaRequestType" AS ENUM ('NEW_PART', 'ENGINEERING_CHANGE', 'DEVIATION', 'REVALIDATION');

-- CreateEnum
CREATE TYPE "CustomerDispositionStatus" AS ENUM ('APPROVED', 'REJECTED', 'CONDITIONAL');

-- AlterEnum
ALTER TYPE "ImpactLevel" ADD VALUE 'NONE';

-- CreateTable
CREATE TABLE "cea_details" (
    "id" TEXT NOT NULL,
    "ppapElementId" TEXT NOT NULL,
    "ceaNo" TEXT,
    "ceaDate" TIMESTAMP(3),
    "requestType" "CeaRequestType",
    "existingCondition" TEXT,
    "proposedChange" TEXT,
    "changeReason" TEXT,
    "impactFitLevel" "ImpactLevel",
    "impactFitNote" TEXT,
    "impactFormLevel" "ImpactLevel",
    "impactFormNote" TEXT,
    "impactFunctionLevel" "ImpactLevel",
    "impactFunctionNote" TEXT,
    "impactQualityRiskLevel" "ImpactLevel",
    "impactQualityRiskNote" TEXT,
    "impactReliabilityLevel" "ImpactLevel",
    "impactReliabilityNote" TEXT,
    "impactRegulatoryLevel" "ImpactLevel",
    "impactRegulatoryNote" TEXT,
    "testsPerformed" TEXT,
    "testStandard" TEXT,
    "resultSummary" TEXT,
    "submissionStatus" TEXT,
    "deviationDescription" TEXT,
    "deviationQty" TEXT,
    "deviationValidityPeriod" TEXT,
    "deviationInterimContainment" TEXT,
    "sampleQty" TEXT,
    "sampleLotNo" TEXT,
    "sampleSubmissionDate" TIMESTAMP(3),
    "declaredById" TEXT,
    "declaredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cea_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cea_attachments" (
    "id" TEXT NOT NULL,
    "ceaDetailId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cea_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_dispositions" (
    "id" TEXT NOT NULL,
    "ppapElementId" TEXT NOT NULL,
    "status" "CustomerDispositionStatus",
    "comments" TEXT,
    "customerName" TEXT,
    "customerDesignation" TEXT,
    "customerSignatureDate" TIMESTAMP(3),
    "recordedById" TEXT,
    "signedFileUrl" TEXT,
    "signedFileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_dispositions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cea_details_ppapElementId_key" ON "cea_details"("ppapElementId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_dispositions_ppapElementId_key" ON "customer_dispositions"("ppapElementId");

-- AddForeignKey
ALTER TABLE "cea_details" ADD CONSTRAINT "cea_details_ppapElementId_fkey" FOREIGN KEY ("ppapElementId") REFERENCES "ppap_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cea_details" ADD CONSTRAINT "cea_details_declaredById_fkey" FOREIGN KEY ("declaredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cea_attachments" ADD CONSTRAINT "cea_attachments_ceaDetailId_fkey" FOREIGN KEY ("ceaDetailId") REFERENCES "cea_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_dispositions" ADD CONSTRAINT "customer_dispositions_ppapElementId_fkey" FOREIGN KEY ("ppapElementId") REFERENCES "ppap_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_dispositions" ADD CONSTRAINT "customer_dispositions_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
