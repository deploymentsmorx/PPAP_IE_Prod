-- CreateEnum
CREATE TYPE "SppTestStatus" AS ENUM ('OK', 'NG');

-- CreateTable
CREATE TABLE "spp_details" (
    "id" TEXT NOT NULL,
    "ppapElementId" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3),
    "packingMethod" TEXT,
    "labelling" TEXT,
    "protectionMethod" TEXT,
    "declaredById" TEXT,
    "declaredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spp_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spp_samples" (
    "id" TEXT NOT NULL,
    "ppapElementId" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "lotBatchNo" TEXT,
    "manufacturingDate" TIMESTAMP(3),
    "shift" TEXT,
    "machineNo" TEXT,
    "cavityNo" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spp_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spp_functional_tests" (
    "id" TEXT NOT NULL,
    "ppapElementId" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "specification" TEXT,
    "result" TEXT,
    "status" "SppTestStatus",
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "spp_functional_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spp_packaging_photos" (
    "id" TEXT NOT NULL,
    "ppapElementId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spp_packaging_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "spp_details_ppapElementId_key" ON "spp_details"("ppapElementId");

-- CreateIndex
CREATE UNIQUE INDEX "spp_samples_ppapElementId_sampleId_key" ON "spp_samples"("ppapElementId", "sampleId");

-- AddForeignKey
ALTER TABLE "spp_details" ADD CONSTRAINT "spp_details_ppapElementId_fkey" FOREIGN KEY ("ppapElementId") REFERENCES "ppap_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spp_details" ADD CONSTRAINT "spp_details_declaredById_fkey" FOREIGN KEY ("declaredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spp_samples" ADD CONSTRAINT "spp_samples_ppapElementId_fkey" FOREIGN KEY ("ppapElementId") REFERENCES "ppap_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spp_functional_tests" ADD CONSTRAINT "spp_functional_tests_ppapElementId_fkey" FOREIGN KEY ("ppapElementId") REFERENCES "ppap_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spp_packaging_photos" ADD CONSTRAINT "spp_packaging_photos_ppapElementId_fkey" FOREIGN KEY ("ppapElementId") REFERENCES "ppap_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
