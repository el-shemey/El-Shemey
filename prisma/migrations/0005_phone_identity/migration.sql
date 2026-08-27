-- CreateEnum
CREATE TYPE "OtpChannel" AS ENUM ('EMAIL', 'SMS');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "phoneVerified" TIMESTAMP(3),
ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");


-- Identity rule: at least one canonical identifier must exist.
ALTER TABLE "User" ADD CONSTRAINT "user_identity_check" CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL);
