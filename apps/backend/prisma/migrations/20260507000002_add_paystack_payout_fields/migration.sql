-- AlterTable: add Paystack transfer code to Payout
ALTER TABLE "Payout" ADD COLUMN "paystackTransferCode" TEXT;

-- AlterTable: cache Paystack recipient code on User
ALTER TABLE "User" ADD COLUMN "paystackRecipientCode" TEXT;

-- AlterTable: add bank account fields to UserProfile for Paystack onboarding
ALTER TABLE "UserProfile" ADD COLUMN "bankAccountNumber" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN "bankAccountName" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN "bankCode" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN "payoutCurrency" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payout_paystackTransferCode_key" ON "Payout"("paystackTransferCode");
