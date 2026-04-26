-- Extend AccountStatus enum with BANNED and PENDING_VERIFICATION
ALTER TYPE "AccountStatus" ADD VALUE IF NOT EXISTS 'BANNED';
ALTER TYPE "AccountStatus" ADD VALUE IF NOT EXISTS 'PENDING_VERIFICATION';

-- Extend ListingStatus enum with SUSPENDED (admin-cancelled via account action)
ALTER TYPE "ListingStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';

-- Add account-status columns to User
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "accountStatus"    "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "suspensionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "suspendedUntil"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "banReason"        TEXT;
