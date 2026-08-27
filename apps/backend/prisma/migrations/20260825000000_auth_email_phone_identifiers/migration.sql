-- AlterEnum
ALTER TYPE "OtpPurpose" ADD VALUE 'PHONE_VERIFICATION';
ALTER TYPE "OtpPurpose" ADD VALUE 'ACCOUNT_RECOVERY';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL,
ADD COLUMN     "phoneVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
