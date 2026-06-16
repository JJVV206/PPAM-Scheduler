-- CreateEnum
CREATE TYPE "ReplacementCensusStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReplacementCensusResponseStatus" AS ENUM ('PENDING', 'SENT', 'SUBMITTED', 'DECLINED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "AppNotificationType" AS ENUM ('CENSUS_PENDING', 'ASSIGNMENT_PENDING', 'ASSIGNMENT_CONFIRMED', 'REPLACEMENT_NEEDED', 'ADMIN_ATTENTION_REQUIRED', 'EMAIL_FAILED');

-- CreateEnum
CREATE TYPE "AppNotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "ReplacementCensus" (
    "id" TEXT NOT NULL,
    "scheduleWeekId" TEXT NOT NULL,
    "status" "ReplacementCensusStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReplacementCensus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplacementCensusResponse" (
    "id" TEXT NOT NULL,
    "censusId" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "status" "ReplacementCensusResponseStatus" NOT NULL DEFAULT 'PENDING',
    "token" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "emailAttempts" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReplacementCensusResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplacementWeeklyAvailability" (
    "id" TEXT NOT NULL,
    "censusResponseId" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "scheduleWeekId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "timeSlot" "TimeSlot",
    "available" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReplacementWeeklyAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "censusId" TEXT,
    "type" "AppNotificationType" NOT NULL,
    "priority" "AppNotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReplacementCensus_scheduleWeekId_key" ON "ReplacementCensus"("scheduleWeekId");

-- CreateIndex
CREATE INDEX "ReplacementCensus_status_closesAt_idx" ON "ReplacementCensus"("status", "closesAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReplacementCensusResponse_token_key" ON "ReplacementCensusResponse"("token");

-- CreateIndex
CREATE UNIQUE INDEX "ReplacementCensusResponse_censusId_volunteerId_key" ON "ReplacementCensusResponse"("censusId", "volunteerId");

-- CreateIndex
CREATE INDEX "ReplacementCensusResponse_volunteerId_status_idx" ON "ReplacementCensusResponse"("volunteerId", "status");

-- CreateIndex
CREATE INDEX "ReplacementCensusResponse_expiresAt_status_idx" ON "ReplacementCensusResponse"("expiresAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ReplacementWeeklyAvailability_censusResponseId_date_timeSlot_key" ON "ReplacementWeeklyAvailability"("censusResponseId", "date", "timeSlot");

-- CreateIndex
CREATE UNIQUE INDEX "ReplacementWeeklyAvailability_censusResponseId_date_null_key" ON "ReplacementWeeklyAvailability"("censusResponseId", "date") WHERE "timeSlot" IS NULL;

-- CreateIndex
CREATE INDEX "ReplacementWeeklyAvailability_scheduleWeekId_date_timeSlot_available_idx" ON "ReplacementWeeklyAvailability"("scheduleWeekId", "date", "timeSlot", "available");

-- CreateIndex
CREATE INDEX "ReplacementWeeklyAvailability_volunteerId_scheduleWeekId_idx" ON "ReplacementWeeklyAvailability"("volunteerId", "scheduleWeekId");

-- CreateIndex
CREATE INDEX "AppNotification_userId_readAt_createdAt_idx" ON "AppNotification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "AppNotification_assignmentId_type_idx" ON "AppNotification"("assignmentId", "type");

-- CreateIndex
CREATE INDEX "AppNotification_censusId_type_idx" ON "AppNotification"("censusId", "type");

-- AddForeignKey
ALTER TABLE "ReplacementCensus" ADD CONSTRAINT "ReplacementCensus_scheduleWeekId_fkey" FOREIGN KEY ("scheduleWeekId") REFERENCES "ScheduleWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplacementCensus" ADD CONSTRAINT "ReplacementCensus_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplacementCensusResponse" ADD CONSTRAINT "ReplacementCensusResponse_censusId_fkey" FOREIGN KEY ("censusId") REFERENCES "ReplacementCensus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplacementCensusResponse" ADD CONSTRAINT "ReplacementCensusResponse_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "VolunteerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplacementWeeklyAvailability" ADD CONSTRAINT "ReplacementWeeklyAvailability_censusResponseId_fkey" FOREIGN KEY ("censusResponseId") REFERENCES "ReplacementCensusResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplacementWeeklyAvailability" ADD CONSTRAINT "ReplacementWeeklyAvailability_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "VolunteerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplacementWeeklyAvailability" ADD CONSTRAINT "ReplacementWeeklyAvailability_scheduleWeekId_fkey" FOREIGN KEY ("scheduleWeekId") REFERENCES "ScheduleWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppNotification" ADD CONSTRAINT "AppNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppNotification" ADD CONSTRAINT "AppNotification_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppNotification" ADD CONSTRAINT "AppNotification_censusId_fkey" FOREIGN KEY ("censusId") REFERENCES "ReplacementCensus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
