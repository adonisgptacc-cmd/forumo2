-- Add GIN index for listing search relevance
CREATE INDEX IF NOT EXISTS "listing_search_fts_idx"
  ON "Listing"
  USING GIN (to_tsvector('english', coalesce("title", '') || ' ' || coalesce("description", '') || ' ' || coalesce("location", '')));

-- Composite index to accelerate structured filters
CREATE INDEX IF NOT EXISTS "listing_status_price_seller_idx"
  ON "Listing" ("status", "priceCents", "sellerId");
