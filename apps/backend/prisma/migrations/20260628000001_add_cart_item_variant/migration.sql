-- Add variant fields to CartItem
ALTER TABLE "CartItem" ADD COLUMN "variantId" TEXT;
ALTER TABLE "CartItem" ADD COLUMN "variantLabel" TEXT;

-- Add FK constraint to ListingVariant (nullable)
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ListingVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Replace old unique constraint (cartId, listingId) with variant-aware one
ALTER TABLE "CartItem" DROP CONSTRAINT IF EXISTS "CartItem_cartId_listingId_key";
CREATE UNIQUE INDEX "CartItem_cartId_listingId_variantId_key"
  ON "CartItem" ("cartId", "listingId", "variantId");
