-- Add Shippo label and rate fields to OrderShipment
ALTER TABLE "OrderShipment" ADD COLUMN "labelUrl" TEXT;
ALTER TABLE "OrderShipment" ADD COLUMN "shippingRateId" TEXT;
ALTER TABLE "OrderShipment" ADD COLUMN "shippoTransactionId" TEXT;

-- Create TrackingEvent table (populated by Shippo tracking_updated webhooks)
CREATE TABLE "TrackingEvent" (
    "id"          TEXT         NOT NULL,
    "orderId"     TEXT         NOT NULL,
    "shipmentId"  TEXT,
    "status"      TEXT         NOT NULL,
    "description" TEXT,
    "location"    TEXT,
    "timestamp"   TIMESTAMP(3) NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrackingEvent_orderId_timestamp_idx" ON "TrackingEvent"("orderId", "timestamp");

ALTER TABLE "TrackingEvent"
    ADD CONSTRAINT "TrackingEvent_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrackingEvent"
    ADD CONSTRAINT "TrackingEvent_shipmentId_fkey"
    FOREIGN KEY ("shipmentId") REFERENCES "OrderShipment"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
