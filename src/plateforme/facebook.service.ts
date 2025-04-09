
import { Injectable, BadRequestException } from "@nestjs/common";
import axios from "axios";
import { PrismaService } from "src/prisma/prisma.service";


@Injectable()
export class FacebookService {
  private readonly FACEBOOK_AUTH_URL = "https://www.facebook.com/v19.0/dialog/oauth";
  private readonly FACEBOOK_TOKEN_URL = "https://graph.facebook.com/v19.0/oauth/access_token";
  private readonly FACEBOOK_USERINFO_URL = "https://graph.facebook.com/me";

  constructor(private prisma: PrismaService) {}

  async getFacebookAuthUrl(businessId: string): Promise<string> {
    const params = new URLSearchParams({
      client_id: process.env.FACEBOOK_CLIENT_ID,
      redirect_uri: process.env.FACEBOOK_REDIRECT_URI,
      state: businessId,
      response_type: "code",
      scope:"pages_show_list,pages_read_engagement,pages_read_user_content",
    
    });
   
    return `${this.FACEBOOK_AUTH_URL}?${params.toString()}`;

  }
  async getFacebookTokens(code: string) {
    try {
      console.log("Code reçu :", code);
      const response = await axios.get(this.FACEBOOK_TOKEN_URL, {
        params: {
          client_id: process.env.FACEBOOK_CLIENT_ID,
          client_secret: process.env.FACEBOOK_CLIENT_SECRET,
          redirect_uri: process.env.FACEBOOK_REDIRECT_URI,
          code,
        },
      });
      console.log("Tokens reçus :", response.data);
      return response.data;
    } catch (error) {
      console.error("Erreur lors de la récupération des tokens :", error.response?.data || error.message);
      throw new BadRequestException("Erreur lors de la récupération des tokens Facebook");
    }
  }
  async getFacebookUserInfo(code: string, businessId: string) {
    const tokens = await this.getFacebookTokens(code);
    
    try {
      const response = await axios.get(this.FACEBOOK_USERINFO_URL, {
        params: {
          access_token: tokens.access_token,
          fields: "id,name,email",
        },
      });
  
      const { email, id: oauthId, name } = response.data;
  
      console.log("Données OAuth reçues :", { oauthId, email, name });
      
      // 1. Récupérer d'abord le business et son utilisateur associé
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
      });
      
      if (!business) {
        throw new BadRequestException(`Business avec ID ${businessId} non trouvé.`);
      
      }
      
      // 2. Vérifier si la plateforme existe déjà
      let existingPlatform = await this.prisma.plateforme.findUnique({
        where: { oauthId },
      });
  
      if (!existingPlatform) {
        // 3. Créer la plateforme avec l'ID de l'utilisateur qui possède le business
        existingPlatform = await this.prisma.plateforme.create({
          data: {
            provider: "FACEBOOK",
            oauthId,
            email, // L'email de Facebook
            accessToken: tokens.access_token,
            userId: business.userId, // Utiliser directement l'ID de l'utilisateur associé au business
          },
        });
        console.log("Nouvelle plateforme créée :", existingPlatform);
      }
  
      // 4. Vérifier l'association Business-Plateforme
      const existingBusinessPlatform = await this.prisma.businessPlateforme.findUnique({
        where: {
          businessId_plateformeId: {
            businessId,
            plateformeId: existingPlatform.id,
          },
        },
      });
  
      if (!existingBusinessPlatform) {
        await this.prisma.businessPlateforme.create({
          data: {
            businessId,
            plateformeId: existingPlatform.id,
          },
        });
        console.log(`Plateforme ${existingPlatform.id} associée au Business ${businessId}`);
      }
  
      return { email, oauthId, name, accessToken: tokens.access_token, businessId };
    } catch (error) {
      console.error("Erreur lors de la récupération des infos utilisateur Facebook :", error);
      throw new BadRequestException("Impossible de récupérer les infos utilisateur Facebook");
    }
  }


async fetchFacebookBusinessData(accessToken: string, retryCount = 0): Promise<any> {
  const apiUrl = "https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token&access_token=" + accessToken;
  
  try {
    console.log("🚀 Fetch Facebook Business - Token reçu:", accessToken.substring(0, 10) + "...");
    console.log("🔍 Requête vers :", apiUrl);

    const response = await axios.get(apiUrl);

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers["retry-after"] || "60", 10);
      console.warn(`⏱️ Rate limit atteint, attente de ${retryAfter} secondes...`);

      if (retryCount < 3) {
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        return this.fetchFacebookBusinessData(accessToken, retryCount + 1);
      } else {
        throw new Error("🚨 Trop de tentatives, échec de la récupération !");
      }
    }

    if (!response.data?.data?.length) {
      throw new Error("❌ Aucun compte Business Facebook trouvé.");
    }

    // Extraction des données
    const firstAccount = response.data.data[0];
    const accountId = firstAccount.id;
    const pageId = firstAccount.id; // Même ID que le compte dans ce cas
    const pageAccessToken = firstAccount.access_token;

    console.log("🔑 Account ID extrait:", accountId);
    console.log("📍 Page ID extrait:", pageId);
    console.log("🔐 Page Access Token extrait:", pageAccessToken?.substring(0, 10) + "...");

    return {
      accountId,
      pageId,
      pageAccessToken,
      rawAccountData: firstAccount,
      rawPageData: firstAccount,
    };
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des données Facebook Business :", error.message);
    return {
      accountId: null,
      pageId: null,
      error: error.message,
      errorStack: error.stack,
    };
  }
}
}