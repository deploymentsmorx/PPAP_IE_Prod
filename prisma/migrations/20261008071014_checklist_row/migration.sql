-- CreateTable
CREATE TABLE "checklist_rows" (
    "id" TEXT NOT NULL,
    "ppapId" TEXT NOT NULL,
    "elementNo" INTEGER NOT NULL,
    "requiredOverride" TEXT,
    "statusOverride" TEXT,
    "remarks" TEXT,
    "docRefLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "checklist_rows_ppapId_elementNo_key" ON "checklist_rows"("ppapId", "elementNo");

-- AddForeignKey
ALTER TABLE "checklist_rows" ADD CONSTRAINT "checklist_rows_ppapId_fkey" FOREIGN KEY ("ppapId") REFERENCES "ppaps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
