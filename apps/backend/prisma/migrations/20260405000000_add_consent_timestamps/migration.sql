-- Add consent timestamp fields to User table
ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "privacyAcceptedAt" TIMESTAMP(3);
