-- Add Stripe Tax fields to Order table
ALTER TABLE "Order" ADD COLUMN "taxAmountCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "taxRate" DECIMAL(10,4);
ALTER TABLE "Order" ADD COLUMN "taxJurisdiction" TEXT;
ALTER TABLE "Order" ADD COLUMN "taxBreakdown" JSONB;
