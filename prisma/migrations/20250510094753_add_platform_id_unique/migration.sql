/*
  Warnings:

  - A unique constraint covering the columns `[platformId]` on the table `Review` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Review_platformId_key" ON "Review"("platformId");
