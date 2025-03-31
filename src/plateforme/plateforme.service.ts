import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class PlateformeService {
  constructor(private prisma: PrismaService) {}

  
  async linkBusinessToGoogle(oauthId: string, email: string, name: string, tokens: any, businessId: string) {
    try {
      console.log("🔍 Vérification de la plateforme avec oauthId:", oauthId);
  
      // 1️⃣ Vérifier si la plateforme existe déjà
      let plateforme = await this.prisma.plateforme.findUnique({
        where: { oauthId },
      });
  
      if (!plateforme) {
        console.log("✅ Plateforme non existante, création en cours...");
  
        plateforme = await this.prisma.plateforme.create({
          data: {
            provider: "GOOGLE",
            oauthId,
            email,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            accountId: tokens.account_id, 
            user: {
              connect: { email }, // Assure-toi que l'utilisateur existe déjà
            },
          },
        });
  
        console.log("🎉 Nouvelle plateforme créée :", plateforme);
      } else {
        console.log(`⚠️ Plateforme ${plateforme.id} existe déjà.`);
      }
  
      // 2️⃣ Vérifier si l'association Business - Plateforme existe déjà
      const existingBusinessPlatform = await this.prisma.businessPlateforme.findUnique({
        where: {
          businessId_plateformeId: {
            businessId,
            plateformeId: plateforme.id,
          },
        },
      });
  
      if (!existingBusinessPlatform) {
        console.log("✅ Création de l'association Business - Plateforme...");
  
        await this.prisma.businessPlateforme.create({
          data: {
            businessId,
            plateformeId: plateforme.id,
          },
        });
  
        console.log(`🎉 Plateforme ${plateforme.id} associée au Business ${businessId}`);
      } else {
        console.log(`⚠️ L'association Business ${businessId} - Plateforme ${plateforme.id} existe déjà.`);
      }
  
      return plateforme;
    } catch (error) {
      console.error("❌ Erreur dans linkBusinessToGoogle :", error);
      throw new BadRequestException("Erreur lors de l'ajout de la plateforme.");
    }
  }
  


  async linkBusinessToFacebook(oauthId: string, email: string, name: string, tokens: any, businessId: string) {
    try {
      console.log("🔍 Vérification de la plateforme Facebook avec oauthId:", oauthId);
  
      // 1️⃣ Vérifier si la plateforme existe déjà
      let plateforme = await this.prisma.plateforme.findUnique({
        where: { oauthId },
      });
  
      if (!plateforme) {
        console.log("✅ Plateforme non existante, création en cours...");
  
        plateforme = await this.prisma.plateforme.create({
          data: {
            provider: "FACEBOOK", // On change GOOGLE -> FACEBOOK
            oauthId,
            email,
            accessToken: tokens.access_token,
            accountId: tokens.account_id, 
            pageAccessToken: tokens.page_access_token,
            user: {
              connect: { email }, // Assure-toi que l'utilisateur existe déjà
            },
          },
        });
  
        console.log("🎉 Nouvelle plateforme Facebook créée :", plateforme);
      } else {
        console.log(`⚠️ Plateforme ${plateforme.id} existe déjà.`);
      }
  
      // 2️⃣ Vérifier si l'association Business - Plateforme existe déjà
      const existingBusinessPlatform = await this.prisma.businessPlateforme.findUnique({
        where: {
          businessId_plateformeId: {
            businessId,
            plateformeId: plateforme.id,
          },
        },
      });
  
      if (!existingBusinessPlatform) {
        console.log("✅ Création de l'association Business - Plateforme Facebook...");
  
        await this.prisma.businessPlateforme.create({
          data: {
            businessId,
            plateformeId: plateforme.id,
          },
        });
  
        console.log(`🎉 Plateforme ${plateforme.id} associée au Business ${businessId}`);
      } else {
        console.log(`⚠️ L'association Business ${businessId} - Plateforme ${plateforme.id} existe déjà.`);
      }

   
  
      return plateforme;
    } catch (error) {
      console.error("❌ Erreur dans linkBusinessToFacebook :", error);
      throw new BadRequestException("Erreur lors de l'ajout de la plateforme Facebook.");
    }
  }
  

 

  async updatePlateformeAccountId(plateformeId: string, accountId: string) {
    console.log(`🔄 Mise à jour de la plateforme ${plateformeId} avec accountId: ${accountId}`);
  
    if (!accountId) {
      console.warn("⚠️ Aucun accountId fourni !");
      return;
    }
  
    return this.prisma.plateforme.update({
      where: { id: plateformeId },
      data: { accountId },
    });
  }
  



  async updatePlateformePageAccessToken(plateformeId: string, pageAccessToken: string) {
    console.log(`🔄 Mise à jour de la plateforme ${plateformeId} avec pageAccessToken`);
    
    if (!pageAccessToken) {
      console.warn("⚠️ Aucun pageAccessToken fourni !");
      return;
    }
    
    return this.prisma.plateforme.update({
      where: { id: plateformeId },
      data: { pageAccessToken },
    });
  }
}
































