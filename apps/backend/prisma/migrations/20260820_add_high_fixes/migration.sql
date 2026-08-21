-- Add new enum values for refund pending/failed
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'REFUND_PENDING';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'REFUND_FAILED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REFUND_PENDING';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REFUND_FAILED';

-- AlterTable: Order add lastProviderEventAt and auctionId
ALTER TABLE "Order" ADD COLUMN "lastProviderEventAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "auctionId" TEXT;
CREATE UNIQUE INDEX "Order_auctionId_key" ON "Order"("auctionId");
CREATE INDEX "Order_lastProviderEventAt_idx" ON "Order"("lastProviderEventAt");

-- AlterTable: WebhookEvent add providerEventId
ALTER TABLE "WebhookEvent" ADD COLUMN "providerEventId" TEXT;
CREATE UNIQUE INDEX "WebhookEvent_providerEventId_key" ON "WebhookEvent"("providerEventId");

-- AlterTable: Payout add orderId
-- Existing payouts intentionally remain NULL because the legacy schema has no
-- deterministic order relation. The scheduler performs a conservative
-- seller/amount/currency reconciliation guard for those rows; ambiguous rows
-- must be reviewed before assigning orderId.
ALTER TABLE "Payout" ADD COLUMN "orderId" TEXT;
CREATE UNIQUE INDEX "Payout_orderId_key" ON "Payout"("orderId");
CREATE INDEX "Payout_orderId_idx" ON "Payout"("orderId");
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
