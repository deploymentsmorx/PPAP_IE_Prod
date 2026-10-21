-- CreateTable
CREATE TABLE "spc_studies" (
    "id" TEXT NOT NULL,
    "ppapElementId" TEXT NOT NULL,
    "specialCharacteristicId" TEXT,
    "characteristicText" TEXT,
    "usl" DOUBLE PRECISION,
    "lsl" DOUBLE PRECISION,
    "specText" TEXT,
    "instrumentId" TEXT,
    "leastCountText" TEXT,
    "machine" TEXT,
    "operation" TEXT,
    "studyDate" TIMESTAMP(3),
    "dcNo" TEXT,
    "qty" INTEGER,
    "decimals" INTEGER NOT NULL DEFAULT 3,
    "subgroupSize" INTEGER NOT NULL DEFAULT 5,
    "subgroupCount" INTEGER NOT NULL DEFAULT 5,
    "cpkAcceptableMin" DOUBLE PRECISION NOT NULL DEFAULT 1.67,
    "cpkConditionalMin" DOUBLE PRECISION NOT NULL DEFAULT 1.33,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spc_studies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spc_readings" (
    "id" TEXT NOT NULL,
    "spcStudyId" TEXT NOT NULL,
    "subgroupIndex" INTEGER NOT NULL,
    "withinIndex" INTEGER NOT NULL,
    "value" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spc_readings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "spc_readings_spcStudyId_subgroupIndex_withinIndex_key" ON "spc_readings"("spcStudyId", "subgroupIndex", "withinIndex");

-- AddForeignKey
ALTER TABLE "spc_studies" ADD CONSTRAINT "spc_studies_ppapElementId_fkey" FOREIGN KEY ("ppapElementId") REFERENCES "ppap_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spc_studies" ADD CONSTRAINT "spc_studies_specialCharacteristicId_fkey" FOREIGN KEY ("specialCharacteristicId") REFERENCES "special_characteristics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spc_studies" ADD CONSTRAINT "spc_studies_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "instruments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spc_readings" ADD CONSTRAINT "spc_readings_spcStudyId_fkey" FOREIGN KEY ("spcStudyId") REFERENCES "spc_studies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
