-- Add flaggedById to ReviewFlag
ALTER TABLE "ReviewFlag" ADD COLUMN "flaggedById" TEXT;

-- CreateIndex
CREATE INDEX "ReviewFlag_flaggedById_idx" ON "ReviewFlag"("flaggedById");

-- AddForeignKey
ALTER TABLE "ReviewFlag" ADD CONSTRAINT "ReviewFlag_flaggedById_fkey" FOREIGN KEY ("flaggedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
