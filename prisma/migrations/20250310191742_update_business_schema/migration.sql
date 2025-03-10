/*
  Warnings:

  - You are about to drop the column `platformId` on the `Business` table. All the data in the column will be lost.
  - Added the required column `email` to the `Business` table without a default value. This is not possible if the table is not empty.
  - Added the required column `plateformeId` to the `Business` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Business" DROP CONSTRAINT "Business_platformId_fkey";

-- DropIndex
DROP INDEX "Plateforme_userId_key";

-- AlterTable
ALTER TABLE "Business" DROP COLUMN "platformId",
ADD COLUMN     "address" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "plateformeId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_plateformeId_fkey" FOREIGN KEY ("plateformeId") REFERENCES "Plateforme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
