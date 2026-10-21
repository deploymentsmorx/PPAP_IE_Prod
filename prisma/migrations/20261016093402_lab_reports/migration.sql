-- CreateEnum
CREATE TYPE "LabMechanicalProperty" AS ENUM ('YIELD_STRENGTH', 'UTS', 'ELONGATION', 'HARDNESS', 'IMPACT');

-- CreateEnum
CREATE TYPE "LabChemicalElement" AS ENUM ('C', 'MN', 'SI', 'S', 'P', 'CR', 'NI', 'MO', 'OTHER');

-- CreateEnum
CREATE TYPE "LabPaintProperty" AS ENUM ('DFT', 'ADHESION', 'GLOSS', 'VISUAL');

-- CreateTable
CREATE TABLE "lab_masters" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accreditationBody" TEXT,
    "certificateNo" TEXT,
    "scope" TEXT,
    "certificatePdfUrl" TEXT,
    "certificatePdfName" TEXT,
    "certificatePdfType" TEXT,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_reports" (
    "id" TEXT NOT NULL,
    "ppapElementId" TEXT NOT NULL,
    "companyName" TEXT,
    "labId" TEXT,
    "reportNo" TEXT,
    "testDate" TIMESTAMP(3),
    "materialSpecId" TEXT,
    "materialGradeText" TEXT,
    "rmtcReportRowId" TEXT,
    "heatBatchNoText" TEXT,
    "sampleQty" INTEGER,
    "manufacturingProcess" TEXT,
    "heatTreatmentStatus" TEXT,
    "labPdfUrl" TEXT,
    "labPdfName" TEXT,
    "labPdfType" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_test_details" (
    "id" TEXT NOT NULL,
    "labReportId" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "acceptanceCriteria" TEXT,
    "methodEquipment" TEXT,
    "standard" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "lab_test_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_mechanical_results" (
    "id" TEXT NOT NULL,
    "labReportId" TEXT NOT NULL,
    "property" "LabMechanicalProperty" NOT NULL,
    "requirementMin" DOUBLE PRECISION,
    "requirementMax" DOUBLE PRECISION,
    "requirementText" TEXT,
    "result" DOUBLE PRECISION,
    "unit" TEXT,
    "remark" TEXT,

    CONSTRAINT "lab_mechanical_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_chemical_results" (
    "id" TEXT NOT NULL,
    "labReportId" TEXT NOT NULL,
    "element" "LabChemicalElement" NOT NULL,
    "requirementMin" DOUBLE PRECISION,
    "requirementMax" DOUBLE PRECISION,
    "requirementText" TEXT,
    "result" DOUBLE PRECISION,

    CONSTRAINT "lab_chemical_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_paint_results" (
    "id" TEXT NOT NULL,
    "labReportId" TEXT NOT NULL,
    "property" "LabPaintProperty" NOT NULL,
    "requirementText" TEXT,
    "resultText" TEXT,
    "resultNumeric" DOUBLE PRECISION,
    "unit" TEXT,
    "remark" TEXT,

    CONSTRAINT "lab_paint_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lab_mechanical_results_labReportId_property_key" ON "lab_mechanical_results"("labReportId", "property");

-- CreateIndex
CREATE UNIQUE INDEX "lab_chemical_results_labReportId_element_key" ON "lab_chemical_results"("labReportId", "element");

-- CreateIndex
CREATE UNIQUE INDEX "lab_paint_results_labReportId_property_key" ON "lab_paint_results"("labReportId", "property");

-- AddForeignKey
ALTER TABLE "lab_reports" ADD CONSTRAINT "lab_reports_ppapElementId_fkey" FOREIGN KEY ("ppapElementId") REFERENCES "ppap_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_reports" ADD CONSTRAINT "lab_reports_labId_fkey" FOREIGN KEY ("labId") REFERENCES "lab_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_reports" ADD CONSTRAINT "lab_reports_materialSpecId_fkey" FOREIGN KEY ("materialSpecId") REFERENCES "material_specs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_reports" ADD CONSTRAINT "lab_reports_rmtcReportRowId_fkey" FOREIGN KEY ("rmtcReportRowId") REFERENCES "rmtc_report_rows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test_details" ADD CONSTRAINT "lab_test_details_labReportId_fkey" FOREIGN KEY ("labReportId") REFERENCES "lab_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_mechanical_results" ADD CONSTRAINT "lab_mechanical_results_labReportId_fkey" FOREIGN KEY ("labReportId") REFERENCES "lab_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_chemical_results" ADD CONSTRAINT "lab_chemical_results_labReportId_fkey" FOREIGN KEY ("labReportId") REFERENCES "lab_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_paint_results" ADD CONSTRAINT "lab_paint_results_labReportId_fkey" FOREIGN KEY ("labReportId") REFERENCES "lab_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
