-- CreateEnum
CREATE TYPE "MasterSampleStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'DISPOSED');

-- CreateTable
CREATE TABLE "master_samples" (
    "id" TEXT NOT NULL,
    "ppapElementId" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "approvalDate" TIMESTAMP(3),
    "storageLocation" TEXT,
    "retentionYears" INTEGER,
    "status" "MasterSampleStatus" NOT NULL DEFAULT 'ACTIVE',
    "remarks" TEXT,
    "supersededAt" TIMESTAMP(3),
    "supersededByPpapId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_sample_images" (
    "id" TEXT NOT NULL,
    "masterSampleId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_sample_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "master_samples_ppapElementId_sampleId_key" ON "master_samples"("ppapElementId", "sampleId");

-- AddForeignKey
ALTER TABLE "master_samples" ADD CONSTRAINT "master_samples_ppapElementId_fkey" FOREIGN KEY ("ppapElementId") REFERENCES "ppap_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_sample_images" ADD CONSTRAINT "master_sample_images_masterSampleId_fkey" FOREIGN KEY ("masterSampleId") REFERENCES "master_samples"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
