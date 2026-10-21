-- CreateEnum
CREATE TYPE "AarSubmissionReason" AS ENUM ('NEW_PART', 'ENGINEERING_CHANGE', 'TOOLING_CHANGE', 'SUPPLIER_CHANGE', 'OTHER');

-- CreateEnum
CREATE TYPE "AarProductionCondition" AS ENUM ('PROTOTYPE', 'TRIAL_RUN', 'MASS_PRODUCTION');

-- CreateEnum
CREATE TYPE "AarOverallResult" AS ENUM ('APPROVED', 'CONDITIONALLY_APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "aar_details" (
    "id" TEXT NOT NULL,
    "ppapElementId" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3),
    "submissionReason" "AarSubmissionReason",
    "submissionReasonOther" TEXT,
    "sampleSize" TEXT,
    "samplesEvaluated" TEXT,
    "sampleIds" TEXT,
    "productionCondition" "AarProductionCondition",
    "masterSampleNo" TEXT,
    "masterSampleApprovedBy" TEXT,
    "masterSampleApprovalDate" TIMESTAMP(3),
    "masterSampleLocation" TEXT,
    "overallResult" "AarOverallResult",
    "deviationDetails" TEXT,
    "correctiveActionPlan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aar_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aar_criteria_rows" (
    "id" TEXT NOT NULL,
    "ppapElementId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "parameter" TEXT NOT NULL,
    "specification" TEXT,
    "evaluationMethod" TEXT,
    "acceptanceCriteria" TEXT,
    "result" TEXT,
    "labPaintProperty" "LabPaintProperty",

    CONSTRAINT "aar_criteria_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aar_photos" (
    "id" TEXT NOT NULL,
    "aarCriteriaRowId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aar_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aar_details_ppapElementId_key" ON "aar_details"("ppapElementId");

-- AddForeignKey
ALTER TABLE "aar_details" ADD CONSTRAINT "aar_details_ppapElementId_fkey" FOREIGN KEY ("ppapElementId") REFERENCES "ppap_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aar_criteria_rows" ADD CONSTRAINT "aar_criteria_rows_ppapElementId_fkey" FOREIGN KEY ("ppapElementId") REFERENCES "ppap_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aar_photos" ADD CONSTRAINT "aar_photos_aarCriteriaRowId_fkey" FOREIGN KEY ("aarCriteriaRowId") REFERENCES "aar_criteria_rows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
