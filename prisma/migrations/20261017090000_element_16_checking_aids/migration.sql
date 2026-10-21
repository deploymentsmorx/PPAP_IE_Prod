-- CreateEnum
CREATE TYPE "FixtureType" AS ENUM ('CHECKING_FIXTURE', 'TEMPLATE', 'JIG', 'GAUGE', 'OTHER');

-- CreateEnum
CREATE TYPE "FixtureStatus" AS ENUM ('ACTIVE', 'UNDER_VALIDATION', 'REJECTED', 'RETIRED');

-- AlterTable: calibration frequency becomes whole months. Add the new
-- column, convert the existing free text ("1 Year", "1 YEAR", "6 Months",
-- "12") before dropping the old column, so no data is lost.
ALTER TABLE "instruments"
ADD COLUMN     "calibrationDueOverridden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "calibrationFrequencyMonths" INTEGER,
ADD COLUMN     "remarks" TEXT;

UPDATE "instruments"
SET "calibrationFrequencyMonths" = CASE
  WHEN "calibrationFrequency" ~* '^\s*\d+\s*(y|yr|yrs|year|years)\s*$'
    THEN (substring("calibrationFrequency" from '\d+'))::int * 12
  WHEN "calibrationFrequency" ~* '^\s*\d+\s*(m|mo|month|months)?\s*$'
    THEN (substring("calibrationFrequency" from '\d+'))::int
  ELSE NULL
END
WHERE "calibrationFrequency" IS NOT NULL;

ALTER TABLE "instruments" DROP COLUMN "calibrationFrequency";

-- CreateTable
CREATE TABLE "calibration_records" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "calibratedOn" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "agency" TEXT,
    "certificateNo" TEXT,
    "certificateFileUrl" TEXT,
    "certificateFileName" TEXT,
    "certificateFileType" TEXT,
    "remarks" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calibration_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixtures" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "FixtureType" NOT NULL DEFAULT 'CHECKING_FIXTURE',
    "partId" TEXT,
    "drawingNo" TEXT,
    "drawingFileUrl" TEXT,
    "drawingFileName" TEXT,
    "validationDate" TIMESTAMP(3),
    "validationRecordUrl" TEXT,
    "validationRecordName" TEXT,
    "status" "FixtureStatus" NOT NULL DEFAULT 'ACTIVE',
    "location" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fixtures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ppap_checking_aids" (
    "id" TEXT NOT NULL,
    "ppapElementId" TEXT NOT NULL,
    "instrumentId" TEXT,
    "fixtureId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ppap_checking_aids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "fixtures_code_key" ON "fixtures"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ppap_checking_aids_ppapElementId_instrumentId_key" ON "ppap_checking_aids"("ppapElementId", "instrumentId");

-- CreateIndex
CREATE UNIQUE INDEX "ppap_checking_aids_ppapElementId_fixtureId_key" ON "ppap_checking_aids"("ppapElementId", "fixtureId");

-- AddForeignKey
ALTER TABLE "calibration_records" ADD CONSTRAINT "calibration_records_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calibration_records" ADD CONSTRAINT "calibration_records_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppap_checking_aids" ADD CONSTRAINT "ppap_checking_aids_ppapElementId_fkey" FOREIGN KEY ("ppapElementId") REFERENCES "ppap_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppap_checking_aids" ADD CONSTRAINT "ppap_checking_aids_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "instruments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppap_checking_aids" ADD CONSTRAINT "ppap_checking_aids_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
