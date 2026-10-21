/*
  Warnings:

  - You are about to drop the column `ceaDetailId` on the `cea_attachments` table. All the data in the column will be lost.
  - Added the required column `ppapElementId` to the `cea_attachments` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "cea_attachments" DROP CONSTRAINT "cea_attachments_ceaDetailId_fkey";

-- AlterTable
ALTER TABLE "cea_attachments" DROP COLUMN "ceaDetailId",
ADD COLUMN     "ppapElementId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "cea_attachments" ADD CONSTRAINT "cea_attachments_ppapElementId_fkey" FOREIGN KEY ("ppapElementId") REFERENCES "ppap_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
