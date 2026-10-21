-- CreateTable
CREATE TABLE "csr_sections" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isZone" BOOLEAN NOT NULL DEFAULT false,
    "colour" TEXT,
    "imageUrl" TEXT,
    "imageName" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csr_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csr_requirements" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "ruleNo" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "criteriaKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csr_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csr_compliances" (
    "id" TEXT NOT NULL,
    "ppapElementId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "complied" BOOLEAN,
    "evidenceElementNo" INTEGER,
    "evidenceFileUrl" TEXT,
    "evidenceFileName" TEXT,
    "remark" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csr_compliances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csr_zone_map_pages" (
    "id" TEXT NOT NULL,
    "ppapElementId" TEXT NOT NULL,
    "title" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "csr_zone_map_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csr_zone_map_views" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageName" TEXT NOT NULL,
    "imageWidth" INTEGER,
    "imageHeight" INTEGER,
    "crop" JSONB,
    "caption" TEXT,
    "annotations" JSONB NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "csr_zone_map_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "csr_sections_customerId_code_key" ON "csr_sections"("customerId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "csr_compliances_ppapElementId_requirementId_key" ON "csr_compliances"("ppapElementId", "requirementId");

-- AddForeignKey
ALTER TABLE "csr_sections" ADD CONSTRAINT "csr_sections_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csr_requirements" ADD CONSTRAINT "csr_requirements_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "csr_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csr_compliances" ADD CONSTRAINT "csr_compliances_ppapElementId_fkey" FOREIGN KEY ("ppapElementId") REFERENCES "ppap_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csr_compliances" ADD CONSTRAINT "csr_compliances_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "csr_requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csr_zone_map_pages" ADD CONSTRAINT "csr_zone_map_pages_ppapElementId_fkey" FOREIGN KEY ("ppapElementId") REFERENCES "ppap_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csr_zone_map_views" ADD CONSTRAINT "csr_zone_map_views_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "csr_zone_map_pages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
