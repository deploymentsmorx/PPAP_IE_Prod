-- AlterTable
ALTER TABLE "ppaps" ADD COLUMN     "submissionElementNos" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "submissionLevelSetAt" TIMESTAMP(3);
