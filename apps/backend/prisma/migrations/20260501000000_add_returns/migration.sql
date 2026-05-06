-- CreateEnum
CREATE TYPE "ReturnReason" AS ENUM ('not_as_described', 'damaged', 'not_received', 'changed_mind', 'other');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('requested', 'awaiting_seller', 'approved', 'rejected', 'shipped', 'received', 'refunded');

-- CreateTable
CREATE TABLE "Return" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "reason" "ReturnReason" NOT NULL,
    "conditionNotes" TEXT,
    "items" JSONB,
    "status" "ReturnStatus" NOT NULL DEFAULT 'requested',
    "trackingNumber" TEXT,
    "refundAmount" INTEGER NOT NULL DEFAULT 0,
    "sellerResponseDeadline" TIMESTAMP(3) NOT NULL,
    "rejectionReason" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Return_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Return_orderId_idx" ON "Return"("orderId");

-- CreateIndex
CREATE INDEX "Return_buyerId_idx" ON "Return"("buyerId");

-- CreateIndex
CREATE INDEX "Return_sellerId_status_idx" ON "Return"("sellerId", "status");

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
