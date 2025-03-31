/*
  Warnings:

  - A unique constraint covering the columns `[phone_number]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "full_name" TEXT,
ADD COLUMN     "phone_number" TEXT,
ADD COLUMN     "profile_picture" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_number_key" ON "User"("phone_number");
