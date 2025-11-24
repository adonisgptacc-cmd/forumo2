-- Enable helpful text search extensions
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add a dedicated tsvector column for weighted search documents
ALTER TABLE "Listing"
  ADD COLUMN IF NOT EXISTS "searchVector" tsvector;

-- Keep the vector in sync via trigger
CREATE OR REPLACE FUNCTION update_listing_search_vector() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', unaccent(coalesce(NEW."title", ''))), 'A') ||
    setweight(to_tsvector('english', unaccent(coalesce(NEW."description", ''))), 'B') ||
    setweight(to_tsvector('english', unaccent(coalesce(NEW."location", ''))), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS listing_search_vector_trigger ON "Listing";
CREATE TRIGGER listing_search_vector_trigger
BEFORE INSERT OR UPDATE ON "Listing"
FOR EACH ROW EXECUTE PROCEDURE update_listing_search_vector();

-- Backfill existing data
UPDATE "Listing"
SET "searchVector" =
  setweight(to_tsvector('english', unaccent(coalesce("title", ''))), 'A') ||
  setweight(to_tsvector('english', unaccent(coalesce("description", ''))), 'B') ||
  setweight(to_tsvector('english', unaccent(coalesce("location", ''))), 'C');

-- Index the search vector for fast lookups
CREATE INDEX IF NOT EXISTS "listing_search_vector_idx"
  ON "Listing" USING GIN ("searchVector");
