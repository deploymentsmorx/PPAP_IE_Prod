-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'QA_ENGINEER', 'QA_MANAGER', 'ENGINEERING', 'PRODUCTION', 'CUSTOMER_APPROVER');

-- CreateEnum
CREATE TYPE "ApprovalMode" AS ENUM ('CUSTOMER_PORTAL', 'SUPPLIER_UPLOAD');

-- CreateEnum
CREATE TYPE "PartRevisionStatus" AS ENUM ('ACTIVE', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ApplicabilityRule" AS ENUM ('REQUIRED', 'RETAIN', 'NA', 'CUSTOMER_DECIDES');

-- CreateEnum
CREATE TYPE "Applicability" AS ENUM ('REQUIRED', 'RETAIN', 'NA');

-- CreateEnum
CREATE TYPE "ElementStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PREPARED', 'CHECKED', 'APPROVED', 'SUBMITTED', 'CUSTOMER_APPROVED', 'CUSTOMER_REJECTED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'APPROVE', 'REVISE', 'DELETE');

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "division" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "buyerCode" TEXT,
    "buyerName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "defaultPpapLevel" INTEGER NOT NULL DEFAULT 3,
    "approvalMode" "ApprovalMode" NOT NULL DEFAULT 'SUPPLIER_UPLOAD',
    "defaultCpk" DECIMAL(6,4),
    "defaultGrrPercent" DECIMAL(6,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "supplierCode" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parts" (
    "id" TEXT NOT NULL,
    "partName" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "projectModel" TEXT,
    "weightKg" DECIMAL(10,3),
    "materialSpecId" TEXT,
    "application" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_revisions" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "revision" TEXT NOT NULL,
    "drawingNo" TEXT,
    "eclDate" TIMESTAMP(3),
    "status" "PartRevisionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "part_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_specs" (
    "id" TEXT NOT NULL,
    "standard" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "cMin" DECIMAL(6,4),
    "cMax" DECIMAL(6,4),
    "mnMin" DECIMAL(6,4),
    "mnMax" DECIMAL(6,4),
    "siMin" DECIMAL(6,4),
    "siMax" DECIMAL(6,4),
    "sMin" DECIMAL(6,4),
    "sMax" DECIMAL(6,4),
    "pMin" DECIMAL(6,4),
    "pMax" DECIMAL(6,4),
    "crMin" DECIMAL(6,4),
    "crMax" DECIMAL(6,4),
    "niMin" DECIMAL(6,4),
    "niMax" DECIMAL(6,4),
    "moMin" DECIMAL(6,4),
    "moMax" DECIMAL(6,4),
    "otherNote" TEXT,
    "ysMinMpa" DECIMAL(8,2),
    "utsMinMpa" DECIMAL(8,2),
    "utsMaxMpa" DECIMAL(8,2),
    "elongationMinPct" DECIMAL(6,2),
    "hardnessNote" TEXT,
    "impactMinJ" DECIMAL(8,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_specs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lookup_lists" (
    "id" TEXT NOT NULL,
    "listKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lookup_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "designation" TEXT,
    "phone" TEXT,
    "roles" "UserRole"[] DEFAULT ARRAY[]::"UserRole"[],
    "signatureUrl" TEXT,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "level_applicability_rules" (
    "id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "elementNo" INTEGER NOT NULL,
    "rule" "ApplicabilityRule" NOT NULL,

    CONSTRAINT "level_applicability_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ppaps" (
    "id" TEXT NOT NULL,
    "partRevisionId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "reasonForSubmission" TEXT,
    "submissionDate" TIMESTAMP(3),
    "approvalMode" "ApprovalMode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ppaps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ppap_elements" (
    "id" TEXT NOT NULL,
    "ppapId" TEXT NOT NULL,
    "elementNo" INTEGER NOT NULL,
    "applicability" "Applicability" NOT NULL,
    "naReason" TEXT,
    "status" "ElementStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "docNo" TEXT,
    "revision" TEXT NOT NULL DEFAULT '00',
    "preparedById" TEXT,
    "preparedAt" TIMESTAMP(3),
    "checkedById" TEXT,
    "checkedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ppap_elements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "ppapId" TEXT,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_code_key" ON "customers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_supplierCode_key" ON "suppliers"("supplierCode");

-- CreateIndex
CREATE UNIQUE INDEX "parts_customerId_partNumber_key" ON "parts"("customerId", "partNumber");

-- CreateIndex
CREATE UNIQUE INDEX "part_revisions_partId_revision_key" ON "part_revisions"("partId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "material_specs_standard_grade_key" ON "material_specs"("standard", "grade");

-- CreateIndex
CREATE UNIQUE INDEX "lookup_lists_listKey_code_key" ON "lookup_lists"("listKey", "code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "level_applicability_rules_level_elementNo_key" ON "level_applicability_rules"("level", "elementNo");

-- CreateIndex
CREATE UNIQUE INDEX "ppap_elements_ppapId_elementNo_key" ON "ppap_elements"("ppapId", "elementNo");

-- AddForeignKey
ALTER TABLE "parts" ADD CONSTRAINT "parts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts" ADD CONSTRAINT "parts_materialSpecId_fkey" FOREIGN KEY ("materialSpecId") REFERENCES "material_specs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_revisions" ADD CONSTRAINT "part_revisions_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppaps" ADD CONSTRAINT "ppaps_partRevisionId_fkey" FOREIGN KEY ("partRevisionId") REFERENCES "part_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppaps" ADD CONSTRAINT "ppaps_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppap_elements" ADD CONSTRAINT "ppap_elements_ppapId_fkey" FOREIGN KEY ("ppapId") REFERENCES "ppaps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppap_elements" ADD CONSTRAINT "ppap_elements_preparedById_fkey" FOREIGN KEY ("preparedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppap_elements" ADD CONSTRAINT "ppap_elements_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppap_elements" ADD CONSTRAINT "ppap_elements_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_ppapId_fkey" FOREIGN KEY ("ppapId") REFERENCES "ppaps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
