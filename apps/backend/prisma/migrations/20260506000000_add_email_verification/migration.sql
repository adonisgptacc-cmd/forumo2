-- Add email verification fields to User.
-- Existing users are backfilled as verified (they pre-date this requirement).
-- New registrations default to false and must go through the email flow.
ALTER TABLE "User"
  ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "emailVerificationToken" TEXT;

-- Switch the DB default to false for new rows going forward.
ALTER TABLE "User" ALTER COLUMN "emailVerified" SET DEFAULT false;
