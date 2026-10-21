-- CreateTable
CREATE TABLE "dfmea_details" (
    "id" TEXT NOT NULL,
    "ppapElementId" TEXT NOT NULL,
    "dfmeaRef" TEXT,
    "startDate" TIMESTAMP(3),
    "revision" TEXT,
    "teamMemberIds" TEXT[],
    "designResponsibility" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dfmea_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dfmea_rows" (
    "id" TEXT NOT NULL,
    "dfmeaDetailId" TEXT NOT NULL,
    "item" TEXT,
    "potentialFailureMode" TEXT,
    "effects" TEXT,
    "severity" INTEGER,
    "causes" TEXT,
    "occurrence" INTEGER,
    "currentControlsPrevention" TEXT,
    "currentControlsDetection" TEXT,
    "detection" INTEGER,
    "recommendedActions" TEXT,
    "responsibleId" TEXT,
    "targetDate" TIMESTAMP(3),
    "actionTaken" TEXT,
    "revisedSeverity" INTEGER,
    "revisedOccurrence" INTEGER,
    "revisedDetection" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dfmea_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dfmea_details_ppapElementId_key" ON "dfmea_details"("ppapElementId");

-- AddForeignKey
ALTER TABLE "dfmea_details" ADD CONSTRAINT "dfmea_details_ppapElementId_fkey" FOREIGN KEY ("ppapElementId") REFERENCES "ppap_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dfmea_rows" ADD CONSTRAINT "dfmea_rows_dfmeaDetailId_fkey" FOREIGN KEY ("dfmeaDetailId") REFERENCES "dfmea_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dfmea_rows" ADD CONSTRAINT "dfmea_rows_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
