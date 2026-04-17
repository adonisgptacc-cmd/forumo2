-- AlterTable: add per-star breakdown columns to SellerReviewRollup
ALTER TABLE "SellerReviewRollup" ADD COLUMN "star1" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SellerReviewRollup" ADD COLUMN "star2" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SellerReviewRollup" ADD COLUMN "star3" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SellerReviewRollup" ADD COLUMN "star4" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SellerReviewRollup" ADD COLUMN "star5" INTEGER NOT NULL DEFAULT 0;
