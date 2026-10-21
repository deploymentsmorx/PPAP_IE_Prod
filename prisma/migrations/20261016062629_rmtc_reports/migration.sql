-- CreateTable
CREATE TABLE "rmtc_report_details" (
    "id" TEXT NOT NULL,
    "ppapElementId" TEXT NOT NULL,
    "projectName" TEXT,
    "otherRef" TEXT,
    "codeNo" TEXT,
    "thicknessToleranceMm" DECIMAL(6,2) NOT NULL DEFAULT 0.3,
    "widthToleranceMm" DECIMAL(8,2) NOT NULL DEFAULT 30,
    "lengthToleranceMm" DECIMAL(8,2) NOT NULL DEFAULT 30,
    "reportRemarks" TEXT,
    "customerWitnessName" TEXT,
    "customerWitnessAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rmtc_report_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rmtc_report_rows" (
    "id" TEXT NOT NULL,
    "rmtcReportDetailId" TEXT NOT NULL,
    "slNo" TEXT NOT NULL,
    "partNo" TEXT,
    "materialSpecId" TEXT,
    "materialSpecText" TEXT,
    "requiredSizeText" TEXT,
    "qtyNos" INTEGER,
    "observedSizeText" TEXT,
    "millTcNo" TEXT,
    "millTcDate" TIMESTAMP(3),
    "heatNo" TEXT,
    "plateNo" TEXT,
    "materialIdNo" TEXT,
    "labReportNo" TEXT,
    "remarks" TEXT,
    "mtcFileUrl" TEXT,
    "mtcFileName" TEXT,
    "mtcFileType" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rmtc_report_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rmtc_report_details_ppapElementId_key" ON "rmtc_report_details"("ppapElementId");

-- AddForeignKey
ALTER TABLE "rmtc_report_details" ADD CONSTRAINT "rmtc_report_details_ppapElementId_fkey" FOREIGN KEY ("ppapElementId") REFERENCES "ppap_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rmtc_report_rows" ADD CONSTRAINT "rmtc_report_rows_rmtcReportDetailId_fkey" FOREIGN KEY ("rmtcReportDetailId") REFERENCES "rmtc_report_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rmtc_report_rows" ADD CONSTRAINT "rmtc_report_rows_materialSpecId_fkey" FOREIGN KEY ("materialSpecId") REFERENCES "material_specs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
