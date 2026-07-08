-- CreateEnum
CREATE TYPE "UserAccountAuditAction" AS ENUM ('SUSPEND', 'REACTIVATE', 'ANONYMIZE', 'NAME_CHANGE');

-- CreateTable
CREATE TABLE "UserAccountAuditLog" (
    "id" TEXT NOT NULL,
    "targetUserId" TEXT,
    "actorUserId" TEXT,
    "action" "UserAccountAuditAction" NOT NULL,
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAccountAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAccountAuditLog_targetUserId_createdAt_idx" ON "UserAccountAuditLog"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "UserAccountAuditLog_actorUserId_createdAt_idx" ON "UserAccountAuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "UserAccountAuditLog_action_createdAt_idx" ON "UserAccountAuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "UserAccountAuditLog" ADD CONSTRAINT "UserAccountAuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccountAuditLog" ADD CONSTRAINT "UserAccountAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
