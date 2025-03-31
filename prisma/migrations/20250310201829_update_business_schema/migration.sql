-- DropForeignKey
ALTER TABLE "Business" DROP CONSTRAINT "Business_plateformeId_fkey";

-- AlterTable
ALTER TABLE "Business" ALTER COLUMN "plateformeId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_plateformeId_fkey" FOREIGN KEY ("plateformeId") REFERENCES "Plateforme"("id") ON DELETE SET NULL ON UPDATE CASCADE;
