-- DropIndex
DROP INDEX "Review_platformId_key";

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "post_id" TEXT;
