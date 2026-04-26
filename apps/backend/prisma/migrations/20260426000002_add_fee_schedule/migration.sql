-- Add feePercent to Order
ALTER TABLE "Order" ADD COLUMN "feePercent" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Create FeeSchedule table
CREATE TABLE "FeeSchedule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT,
    "feePercent" DECIMAL(5,2) NOT NULL,
    "fixedFeeCents" INTEGER NOT NULL DEFAULT 0,
    "minFeeCents" INTEGER NOT NULL DEFAULT 0,
    "maxFeeCents" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "FeeSchedule_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "FeeSchedule" ADD CONSTRAINT "FeeSchedule_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "ListingCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FeeSchedule" ADD CONSTRAINT "FeeSchedule_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Index for fast lookups
CREATE INDEX "FeeSchedule_categoryId_isActive_idx" ON "FeeSchedule"("categoryId", "isActive");
