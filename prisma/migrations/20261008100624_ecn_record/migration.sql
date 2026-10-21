-- CreateEnum
CREATE TYPE "ChangeType" AS ENUM ('DESIGN', 'PROCESS', 'MATERIAL');

-- CreateEnum
CREATE TYPE "ImpactLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "StockDisposition" AS ENUM ('USE', 'REJECT', 'REWORK');

-- CreateEnum
CREATE TYPE "EcnStatus" AS ENUM ('DRAFT', 'REVIEWED', 'APPROVED');

-- AlterTable
ALTER TABLE "ppap_elements" ADD COLUMN     "revisionRequired" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ecn_records" (
    "id" TEXT NOT NULL,
    "ppapElementId" TEXT NOT NULL,
    "ecnNumber" TEXT NOT NULL,
    "ecnDate" TIMESTAMP(3),
    "partNameSnapshot" TEXT,
    "partNumberSnapshot" TEXT,
    "customerNameSnapshot" TEXT,
    "drawingNumberSnapshot" TEXT,
    "drawingRevisionSnapshot" TEXT,
    "department" TEXT,
    "changeType" "ChangeType",
    "reason" TEXT,
    "existingCondition" TEXT,
    "proposedChange" TEXT,
    "impactQualityLevel" "ImpactLevel",
    "impactQualityNote" TEXT,
    "impactCostLevel" "ImpactLevel",
    "impactCostNote" TEXT,
    "impactDeliveryLevel" "ImpactLevel",
    "impactDeliveryNote" TEXT,
    "affectedElementNos" INTEGER[],
    "affectedDocsFreeText" TEXT,
    "stockDisposition" "StockDisposition",
    "implementationDate" TIMESTAMP(3),
    "status" "EcnStatus" NOT NULL DEFAULT 'DRAFT',
    "preparedById" TEXT,
    "preparedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "newPartRevisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ecn_records_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ecn_records" ADD CONSTRAINT "ecn_records_ppapElementId_fkey" FOREIGN KEY ("ppapElementId") REFERENCES "ppap_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecn_records" ADD CONSTRAINT "ecn_records_preparedById_fkey" FOREIGN KEY ("preparedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecn_records" ADD CONSTRAINT "ecn_records_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecn_records" ADD CONSTRAINT "ecn_records_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecn_records" ADD CONSTRAINT "ecn_records_newPartRevisionId_fkey" FOREIGN KEY ("newPartRevisionId") REFERENCES "part_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
