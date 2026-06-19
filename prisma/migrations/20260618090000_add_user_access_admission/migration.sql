-- CreateEnum
CREATE TYPE "UserAccessStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "accessStatus" "UserAccessStatus" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN "accessReviewedAt" TIMESTAMP(3),
ADD COLUMN "accessReviewedById" TEXT,
ADD COLUMN "accessReviewNote" TEXT;

-- Backfill explicit account status and required phone for existing rows.
UPDATE "User"
SET "accessStatus" = 'SUSPENDED'
WHERE "active" = false;

UPDATE "User"
SET "phone" = CONCAT('missing-phone-', "id")
WHERE "phone" IS NULL OR btrim("phone") = '';

ALTER TABLE "User"
ALTER COLUMN "phone" SET NOT NULL;

-- CreateIndex
CREATE INDEX "User_accessStatus_role_createdAt_idx" ON "User"("accessStatus", "role", "createdAt");

-- CreateIndex
CREATE INDEX "User_accessReviewedById_idx" ON "User"("accessReviewedById");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_accessReviewedById_fkey" FOREIGN KEY ("accessReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
