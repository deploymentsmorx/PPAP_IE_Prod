-- CreateEnum
CREATE TYPE "CharClass" AS ENUM ('CRITICAL', 'MAJOR');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('ACTIVE', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "design_record_details" (
    "id" TEXT NOT NULL,
    "ppapElementId" TEXT NOT NULL,
    "partNameRemarks" TEXT,
    "partNumberRemarks" TEXT,
    "customerNameRemarks" TEXT,
    "drawingNumberRemarks" TEXT,
    "drawingRevisionRemarks" TEXT,
    "materialSpecId" TEXT,
    "materialSpecRemarks" TEXT,
    "heatTreatment" TEXT,
    "heatTreatmentRemarks" TEXT,
    "surfaceFinish" TEXT,
    "surfaceFinishRemarks" TEXT,
    "specialCharacteristicsRemarks" TEXT,
    "ballooningImageUrl" TEXT,
    "ballooningImageName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "design_record_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "special_characteristics" (
    "id" TEXT NOT NULL,
    "ppapElementId" TEXT NOT NULL,
    "characteristic" TEXT NOT NULL,
    "charClass" "CharClass" NOT NULL,
    "symbol" TEXT,
    "drawingRef" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "special_characteristics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drawing_files" (
    "id" TEXT NOT NULL,
    "ppapElementId" TEXT NOT NULL,
    "revision" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "status" "FileStatus" NOT NULL DEFAULT 'ACTIVE',
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drawing_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balloons" (
    "id" TEXT NOT NULL,
    "ppapElementId" TEXT NOT NULL,
    "balloonNo" INTEGER NOT NULL,
    "viewSection" TEXT,
    "description" TEXT,
    "nominal" TEXT,
    "tolerance" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "balloons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "design_record_details_ppapElementId_key" ON "design_record_details"("ppapElementId");

-- CreateIndex
CREATE UNIQUE INDEX "balloons_ppapElementId_balloonNo_key" ON "balloons"("ppapElementId", "balloonNo");

-- AddForeignKey
ALTER TABLE "design_record_details" ADD CONSTRAINT "design_record_details_ppapElementId_fkey" FOREIGN KEY ("ppapElementId") REFERENCES "ppap_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_record_details" ADD CONSTRAINT "design_record_details_materialSpecId_fkey" FOREIGN KEY ("materialSpecId") REFERENCES "material_specs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "special_characteristics" ADD CONSTRAINT "special_characteristics_ppapElementId_fkey" FOREIGN KEY ("ppapElementId") REFERENCES "ppap_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawing_files" ADD CONSTRAINT "drawing_files_ppapElementId_fkey" FOREIGN KEY ("ppapElementId") REFERENCES "ppap_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawing_files" ADD CONSTRAINT "drawing_files_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balloons" ADD CONSTRAINT "balloons_ppapElementId_fkey" FOREIGN KEY ("ppapElementId") REFERENCES "ppap_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
