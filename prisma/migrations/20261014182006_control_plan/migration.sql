-- CreateTable
CREATE TABLE "instruments" (
    "id" TEXT NOT NULL,
    "slNo" INTEGER,
    "description" TEXT NOT NULL,
    "range" TEXT,
    "serialNo" TEXT,
    "ieIdNo" TEXT,
    "make" TEXT,
    "calibrationFrequency" TEXT,
    "calibratedOn" TIMESTAMP(3),
    "calibrationDue" TIMESTAMP(3),
    "leastCount" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instruments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_plan_details" (
    "id" TEXT NOT NULL,
    "ppapElementId" TEXT NOT NULL,
    "phasePrototype" BOOLEAN NOT NULL DEFAULT false,
    "phasePreLaunch" BOOLEAN NOT NULL DEFAULT false,
    "phaseProduction" BOOLEAN NOT NULL DEFAULT false,
    "controlPlanNo" TEXT,
    "revisionNo" TEXT,
    "dateOrig" TIMESTAMP(3),
    "dateRev" TIMESTAMP(3),
    "partDescription" TEXT,
    "customerPartNo" TEXT,
    "customerPartRevision" TEXT,
    "partNo" TEXT,
    "partRevision" TEXT,
    "supplier" TEXT,
    "plant" TEXT,
    "material" TEXT,
    "keyContactPhone" TEXT,
    "coreTeamText" TEXT,
    "supplierPlantApprovalDate" TIMESTAMP(3),
    "customerEngineeringApprovalDate" TIMESTAMP(3),
    "customerQualityApprovalDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "control_plan_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_plan_rows" (
    "id" TEXT NOT NULL,
    "controlPlanDetailId" TEXT NOT NULL,
    "processNameOperation" TEXT,
    "machineDeviceJigTools" TEXT,
    "stageNo" INTEGER,
    "productCharacteristic" TEXT,
    "processCharacteristic" TEXT,
    "specialCharacteristicId" TEXT,
    "productProcessSpecification" TEXT,
    "evaluationMeasurementTechnique" TEXT,
    "instrumentId" TEXT,
    "leastCountText" TEXT,
    "controlInCharge" TEXT,
    "sampleSize" TEXT,
    "sampleFrequency" TEXT,
    "recordingRequired" BOOLEAN,
    "controlMethod" TEXT,
    "reactionPlan" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "control_plan_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "instruments_ieIdNo_key" ON "instruments"("ieIdNo");

-- CreateIndex
CREATE UNIQUE INDEX "control_plan_details_ppapElementId_key" ON "control_plan_details"("ppapElementId");

-- AddForeignKey
ALTER TABLE "control_plan_details" ADD CONSTRAINT "control_plan_details_ppapElementId_fkey" FOREIGN KEY ("ppapElementId") REFERENCES "ppap_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_plan_rows" ADD CONSTRAINT "control_plan_rows_controlPlanDetailId_fkey" FOREIGN KEY ("controlPlanDetailId") REFERENCES "control_plan_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_plan_rows" ADD CONSTRAINT "control_plan_rows_specialCharacteristicId_fkey" FOREIGN KEY ("specialCharacteristicId") REFERENCES "special_characteristics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_plan_rows" ADD CONSTRAINT "control_plan_rows_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "instruments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
