-- CreateEnum
CREATE TYPE "AssignmentInvitationType" AS ENUM ('PRIMARY', 'REPLACEMENT');

-- CreateEnum
CREATE TYPE "AssignmentInvitationStatus" AS ENUM ('PENDING', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'FAILED');

-- AlterTable
ALTER TABLE "VolunteerProfile" ADD COLUMN "canServeAsReplacement" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "AssignmentInvitation" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "type" "AssignmentInvitationType" NOT NULL,
    "status" "AssignmentInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "token" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "emailAttempts" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentInvitation_token_key" ON "AssignmentInvitation"("token");

-- CreateIndex
CREATE INDEX "AssignmentInvitation_assignmentId_status_idx" ON "AssignmentInvitation"("assignmentId", "status");

-- CreateIndex
CREATE INDEX "AssignmentInvitation_volunteerId_status_idx" ON "AssignmentInvitation"("volunteerId", "status");

-- CreateIndex
CREATE INDEX "AssignmentInvitation_expiresAt_status_idx" ON "AssignmentInvitation"("expiresAt", "status");

-- CreateIndex
CREATE INDEX "AssignmentInvitation_assignmentId_volunteerId_type_status_idx" ON "AssignmentInvitation"("assignmentId", "volunteerId", "type", "status");

-- AddForeignKey
ALTER TABLE "AssignmentInvitation" ADD CONSTRAINT "AssignmentInvitation_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentInvitation" ADD CONSTRAINT "AssignmentInvitation_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "VolunteerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
