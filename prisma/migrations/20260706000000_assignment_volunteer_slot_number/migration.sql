-- Migrate fixed pair positions to dynamic integrante slots.
ALTER TABLE "AssignmentVolunteer" ADD COLUMN "slotNumber" INTEGER;

UPDATE "AssignmentVolunteer"
SET "slotNumber" = CASE "position"
  WHEN 'FIRST' THEN 1
  WHEN 'SECOND' THEN 2
  ELSE 1
END;

ALTER TABLE "AssignmentVolunteer" ALTER COLUMN "slotNumber" SET NOT NULL;

DROP INDEX "AssignmentVolunteer_assignmentId_position_key";

ALTER TABLE "AssignmentVolunteer" DROP COLUMN "position";

CREATE UNIQUE INDEX "AssignmentVolunteer_assignmentId_slotNumber_key" ON "AssignmentVolunteer"("assignmentId", "slotNumber");

DROP TYPE "VolunteerPosition";
