-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "lastAnalyzed" TIMESTAMP(3),
ADD COLUMN     "rating" DOUBLE PRECISION DEFAULT 0.0,
ADD COLUMN     "reviewCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "rating" INTEGER;

-- CreateIndex
CREATE INDEX "Business_rating_idx" ON "Business"("rating");

-- CreateIndex
CREATE INDEX "Business_reviewCount_idx" ON "Business"("reviewCount");

-- CreateIndex
CREATE INDEX "Review_businessId_idx" ON "Review"("businessId");

-- CreateIndex
CREATE INDEX "Review_createdAt_idx" ON "Review"("createdAt");

-- CreateIndex
CREATE INDEX "Review_rating_idx" ON "Review"("rating");
