-- CreateTable
CREATE TABLE "dimensional_report_details" (
    "id" TEXT NOT NULL,
    "ppapElementId" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3),
    "reportSlNo" TEXT,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dimensional_report_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dimensional_report_sample_columns" (
    "id" TEXT NOT NULL,
    "dimensionalReportDetailId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "dimensional_report_sample_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dimensional_report_rows" (
    "id" TEXT NOT NULL,
    "dimensionalReportDetailId" TEXT NOT NULL,
    "balloonId" TEXT,
    "slNo" TEXT NOT NULL,
    "view" TEXT,
    "parameterDescription" TEXT,
    "designDimensionText" TEXT,
    "toleranceText" TEXT,
    "instrumentId" TEXT,
    "instrumentUsedText" TEXT,
    "remarks" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dimensional_report_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dimensional_report_readings" (
    "id" TEXT NOT NULL,
    "dimensionalReportRowId" TEXT NOT NULL,
    "sampleColumnId" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dimensional_report_readings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dimensional_report_details_ppapElementId_key" ON "dimensional_report_details"("ppapElementId");

-- CreateIndex
CREATE UNIQUE INDEX "dimensional_report_readings_dimensionalReportRowId_sampleCo_key" ON "dimensional_report_readings"("dimensionalReportRowId", "sampleColumnId");

-- AddForeignKey
ALTER TABLE "dimensional_report_details" ADD CONSTRAINT "dimensional_report_details_ppapElementId_fkey" FOREIGN KEY ("ppapElementId") REFERENCES "ppap_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dimensional_report_sample_columns" ADD CONSTRAINT "dimensional_report_sample_columns_dimensionalReportDetailI_fkey" FOREIGN KEY ("dimensionalReportDetailId") REFERENCES "dimensional_report_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dimensional_report_rows" ADD CONSTRAINT "dimensional_report_rows_dimensionalReportDetailId_fkey" FOREIGN KEY ("dimensionalReportDetailId") REFERENCES "dimensional_report_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dimensional_report_rows" ADD CONSTRAINT "dimensional_report_rows_balloonId_fkey" FOREIGN KEY ("balloonId") REFERENCES "balloons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dimensional_report_rows" ADD CONSTRAINT "dimensional_report_rows_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "instruments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dimensional_report_readings" ADD CONSTRAINT "dimensional_report_readings_dimensionalReportRowId_fkey" FOREIGN KEY ("dimensionalReportRowId") REFERENCES "dimensional_report_rows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dimensional_report_readings" ADD CONSTRAINT "dimensional_report_readings_sampleColumnId_fkey" FOREIGN KEY ("sampleColumnId") REFERENCES "dimensional_report_sample_columns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
