-- CreateEnum
CREATE TYPE "PpapStatus" AS ENUM ('OPEN', 'SUBMITTED', 'CLOSED');

-- AlterTable
ALTER TABLE "ppaps" ADD COLUMN     "lastRejectionComments" TEXT,
ADD COLUMN     "status" "PpapStatus" NOT NULL DEFAULT 'OPEN',
ADD COLUMN     "statusChangedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "psw_details" (
    "id" TEXT NOT NULL,
    "ppapElementId" TEXT NOT NULL,
    "safetyGovRegulation" BOOLEAN,
    "poNumber" TEXT,
    "checkingAidNo" TEXT,
    "checkingAidEcl" TEXT,
    "checkingAidEclDate" TIMESTAMP(3),
    "submittalDimensional" BOOLEAN NOT NULL DEFAULT true,
    "submittalMaterials" BOOLEAN NOT NULL DEFAULT true,
    "submittalAppearance" BOOLEAN NOT NULL DEFAULT true,
    "reasons" TEXT[],
    "otherReasonText" TEXT,
    "resultsMeetRequirements" BOOLEAN,
    "explanation" TEXT,
    "productionRateQty" TEXT,
    "productionRateHours" TEXT,
    "printName" TEXT,
    "title" TEXT,
    "phone" TEXT,
    "signedById" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "psw_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "psw_details_ppapElementId_key" ON "psw_details"("ppapElementId");

-- AddForeignKey
ALTER TABLE "psw_details" ADD CONSTRAINT "psw_details_ppapElementId_fkey" FOREIGN KEY ("ppapElementId") REFERENCES "ppap_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psw_details" ADD CONSTRAINT "psw_details_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
