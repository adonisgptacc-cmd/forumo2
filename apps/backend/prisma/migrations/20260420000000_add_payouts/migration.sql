-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED');

-- AlterTable: add Stripe Connect fields to User
ALTER TABLE "User"
  ADD COLUMN "stripeConnectAccountId" TEXT,
  ADD COLUMN "stripeConnectOnboarded" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Payout" (
  "id"                     TEXT NOT NULL,
  "sellerId"               TEXT NOT NULL,
  "amount"                 INTEGER NOT NULL,
  "currency"               TEXT NOT NULL DEFAULT 'zar',
  "stripeTransferId"       TEXT,
  "stripeConnectAccountId" TEXT,
  "status"                 "PayoutStatus" NOT NULL DEFAULT 'PENDING',
  "retryCount"             INTEGER NOT NULL DEFAULT 0,
  "scheduledAt"            TIMESTAMP(3),
  "processedAt"            TIMESTAMP(3),
  "failureReason"          TEXT,
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payout_stripeTransferId_key" ON "Payout"("stripeTransferId");

-- CreateIndex
CREATE INDEX "Payout_sellerId_status_idx" ON "Payout"("sellerId", "status");

-- CreateIndex
CREATE INDEX "Payout_status_scheduledAt_idx" ON "Payout"("status", "scheduledAt");

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
