/*
  Warnings:

  - You are about to drop the column `plateformeId` on the `Business` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Business" DROP CONSTRAINT "Business_plateformeId_fkey";

-- AlterTable
ALTER TABLE "Business" DROP COLUMN "plateformeId";

-- CreateTable
CREATE TABLE "BusinessPlateforme" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "plateformeId" TEXT NOT NULL,

    CONSTRAINT "BusinessPlateforme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessPlateforme_businessId_plateformeId_key" ON "BusinessPlateforme"("businessId", "plateformeId");

-- AddForeignKey
ALTER TABLE "BusinessPlateforme" ADD CONSTRAINT "BusinessPlateforme_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessPlateforme" ADD CONSTRAINT "BusinessPlateforme_plateformeId_fkey" FOREIGN KEY ("plateformeId") REFERENCES "Plateforme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
