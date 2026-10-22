-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';
ALTER TYPE "UserRole" ADD VALUE 'LEAD';

-- CreateTable
CREATE TABLE "customer_licenses" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "licenseKey" TEXT NOT NULL,
    "installPasswordHash" TEXT NOT NULL,
    "requireDevice" BOOLEAN NOT NULL DEFAULT true,
    "grantFullAccess" BOOLEAN NOT NULL DEFAULT false,
    "deviceId" TEXT,
    "hostName" TEXT,
    "engineerName" TEXT NOT NULL,
    "engineerEmail" TEXT NOT NULL,
    "engineerRole" "UserRole" NOT NULL,
    "status" "LicenseStatus" NOT NULL DEFAULT 'PENDING',
    "activatedAt" TIMESTAMP(3),
    "engineerUserId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_licenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_licenses_licenseKey_key" ON "customer_licenses"("licenseKey");
CREATE UNIQUE INDEX "customer_licenses_engineerUserId_key" ON "customer_licenses"("engineerUserId");
CREATE INDEX "customer_licenses_status_createdAt_idx" ON "customer_licenses"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "customer_licenses" ADD CONSTRAINT "customer_licenses_engineerUserId_fkey" FOREIGN KEY ("engineerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_licenses" ADD CONSTRAINT "customer_licenses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;