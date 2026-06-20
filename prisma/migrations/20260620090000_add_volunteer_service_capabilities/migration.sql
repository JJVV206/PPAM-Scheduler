ALTER TABLE "VolunteerProfile"
ADD COLUMN "canServeAsPrimary" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "VolunteerProfile"
ALTER COLUMN "canServeAsReplacement" SET DEFAULT false;
