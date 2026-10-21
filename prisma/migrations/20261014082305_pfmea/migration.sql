-- CreateTable
CREATE TABLE "pfmea_process_steps" (
    "id" TEXT NOT NULL,
    "ppapElementId" TEXT NOT NULL,
    "operationCode" TEXT,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "removedFromSource" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pfmea_process_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pfmea_rows" (
    "id" TEXT NOT NULL,
    "pfmeaProcessStepId" TEXT NOT NULL,
    "processFunction" TEXT,
    "potentialFailureMode" TEXT,
    "potentialEffect" TEXT,
    "severity" INTEGER,
    "potentialCause" TEXT,
    "occurrence" INTEGER,
    "currentPreventionControls" TEXT,
    "currentDetectionControls" TEXT,
    "detection" INTEGER,
    "importedApText" TEXT,
    "recommendedActions" TEXT,
    "responsibleId" TEXT,
    "targetDate" TIMESTAMP(3),
    "actionTaken" TEXT,
    "revisedSeverity" INTEGER,
    "revisedOccurrence" INTEGER,
    "revisedDetection" INTEGER,
    "importedRevisedApText" TEXT,
    "revisionNo" TEXT,
    "revisionDate" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pfmea_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pfmea_failure_mode_templates" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "processFunction" TEXT,
    "potentialFailureMode" TEXT,
    "potentialEffect" TEXT,
    "severity" INTEGER,
    "potentialCause" TEXT,
    "occurrence" INTEGER,
    "currentPreventionControls" TEXT,
    "currentDetectionControls" TEXT,
    "detection" INTEGER,
    "recommendedActions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pfmea_failure_mode_templates_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "pfmea_process_steps" ADD CONSTRAINT "pfmea_process_steps_ppapElementId_fkey" FOREIGN KEY ("ppapElementId") REFERENCES "ppap_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pfmea_rows" ADD CONSTRAINT "pfmea_rows_pfmeaProcessStepId_fkey" FOREIGN KEY ("pfmeaProcessStepId") REFERENCES "pfmea_process_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pfmea_rows" ADD CONSTRAINT "pfmea_rows_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pfmea_failure_mode_templates" ADD CONSTRAINT "pfmea_failure_mode_templates_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
