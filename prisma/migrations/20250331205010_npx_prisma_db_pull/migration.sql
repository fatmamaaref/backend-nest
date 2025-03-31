-- DropForeignKey
ALTER TABLE "Business" DROP CONSTRAINT "Business_userId_fkey";

-- DropForeignKey
ALTER TABLE "BusinessPlateforme" DROP CONSTRAINT "BusinessPlateforme_businessId_fkey";

-- DropForeignKey
ALTER TABLE "BusinessPlateforme" DROP CONSTRAINT "BusinessPlateforme_plateformeId_fkey";

-- DropForeignKey
ALTER TABLE "Plateforme" DROP CONSTRAINT "Plateforme_userId_fkey";

-- AlterTable
ALTER TABLE "Plateforme" ADD COLUMN     "pageAccessToken" TEXT;

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sentiment" TEXT,
    "response" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plateforme" ADD CONSTRAINT "Plateforme_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessPlateforme" ADD CONSTRAINT "BusinessPlateforme_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessPlateforme" ADD CONSTRAINT "BusinessPlateforme_plateformeId_fkey" FOREIGN KEY ("plateformeId") REFERENCES "Plateforme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
