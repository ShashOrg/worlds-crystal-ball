-- DropForeignKey
ALTER TABLE "public"."UserPick" DROP CONSTRAINT "UserPick_userId_fkey";

-- AlterTable
ALTER TABLE "ExternalMetric" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "UserPick" ADD CONSTRAINT "UserPick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
