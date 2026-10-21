-- CreateEnum
CREATE TYPE "OperationSymbol" AS ENUM ('OPERATION', 'INSPECTION', 'STORAGE', 'TRANSPORT', 'DELAY');

-- CreateEnum
CREATE TYPE "ChildPartSide" AS ENUM ('LEFT', 'RIGHT');

-- CreateEnum
CREATE TYPE "ChildPartType" AS ENUM ('MAKE', 'BOP');

-- CreateTable
CREATE TABLE "operations" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" "OperationSymbol" NOT NULL,
    "defaultInspectionAfter" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_parts" (
    "id" TEXT NOT NULL,
    "ppapElementId" TEXT NOT NULL,
    "itemNo" INTEGER NOT NULL,
    "partNo" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "qtyPerAssembly" INTEGER NOT NULL,
    "side" "ChildPartSide" NOT NULL,
    "type" "ChildPartType" NOT NULL DEFAULT 'MAKE',
    "sketchImageUrl" TEXT,
    "sketchFileName" TEXT,
    "parentChildPartId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "child_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" TEXT NOT NULL,
    "ppapElementId" TEXT NOT NULL,
    "childPartId" TEXT,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_steps" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "machine" TEXT,
    "note" TEXT,

    CONSTRAINT "route_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "operations_code_key" ON "operations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "child_parts_ppapElementId_itemNo_key" ON "child_parts"("ppapElementId", "itemNo");

-- CreateIndex
CREATE UNIQUE INDEX "routes_childPartId_key" ON "routes"("childPartId");

-- AddForeignKey
ALTER TABLE "child_parts" ADD CONSTRAINT "child_parts_ppapElementId_fkey" FOREIGN KEY ("ppapElementId") REFERENCES "ppap_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_parts" ADD CONSTRAINT "child_parts_parentChildPartId_fkey" FOREIGN KEY ("parentChildPartId") REFERENCES "child_parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_ppapElementId_fkey" FOREIGN KEY ("ppapElementId") REFERENCES "ppap_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_childPartId_fkey" FOREIGN KEY ("childPartId") REFERENCES "child_parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_steps" ADD CONSTRAINT "route_steps_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_steps" ADD CONSTRAINT "route_steps_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
