-- CreateEnum
CREATE TYPE "MsaStudyType" AS ENUM ('VARIABLE_GRR', 'ATTRIBUTE_AGREEMENT', 'BIAS', 'LINEARITY', 'STABILITY');

-- CreateEnum
CREATE TYPE "MsaMethod" AS ENUM ('AVERAGE_RANGE', 'ANOVA');

-- CreateTable
CREATE TABLE "msa_studies" (
    "id" TEXT NOT NULL,
    "ppapElementId" TEXT NOT NULL,
    "studyType" "MsaStudyType" NOT NULL DEFAULT 'VARIABLE_GRR',
    "method" "MsaMethod" NOT NULL DEFAULT 'AVERAGE_RANGE',
    "studyDate" TIMESTAMP(3),
    "units" TEXT,
    "gaugeId" TEXT,
    "gaugeType" TEXT,
    "controlPlanRowId" TEXT,
    "characteristicText" TEXT,
    "specification" TEXT,
    "testNo" TEXT,
    "appraiserAName" TEXT,
    "appraiserBName" TEXT,
    "appraiserCName" TEXT,
    "parts" INTEGER NOT NULL DEFAULT 10,
    "appraisers" INTEGER NOT NULL DEFAULT 3,
    "trials" INTEGER NOT NULL DEFAULT 3,
    "usl" DOUBLE PRECISION,
    "lsl" DOUBLE PRECISION,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "msa_studies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "msa_data_points" (
    "id" TEXT NOT NULL,
    "msaStudyId" TEXT NOT NULL,
    "appraiserIndex" INTEGER NOT NULL,
    "partIndex" INTEGER NOT NULL,
    "trialIndex" INTEGER NOT NULL,
    "value" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "msa_data_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "msa_data_points_msaStudyId_appraiserIndex_partIndex_trialIn_key" ON "msa_data_points"("msaStudyId", "appraiserIndex", "partIndex", "trialIndex");

-- AddForeignKey
ALTER TABLE "msa_studies" ADD CONSTRAINT "msa_studies_ppapElementId_fkey" FOREIGN KEY ("ppapElementId") REFERENCES "ppap_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "msa_studies" ADD CONSTRAINT "msa_studies_gaugeId_fkey" FOREIGN KEY ("gaugeId") REFERENCES "instruments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "msa_studies" ADD CONSTRAINT "msa_studies_controlPlanRowId_fkey" FOREIGN KEY ("controlPlanRowId") REFERENCES "control_plan_rows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "msa_data_points" ADD CONSTRAINT "msa_data_points_msaStudyId_fkey" FOREIGN KEY ("msaStudyId") REFERENCES "msa_studies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
