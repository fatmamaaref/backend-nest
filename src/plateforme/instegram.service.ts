import { Injectable, BadRequestException } from "@nestjs/common";
import axios from "axios";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class InstagramService {
  private readonly INSTAGRAM_AUTH_URL = "https://api.instagram.com/oauth/authorize";
  private readonly INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
  private readonly INSTAGRAM_GRAPH_URL = "https://graph.instagram.com";
  private readonly INSTAGRAM_API_URL = "https://graph.facebook.com/v18.0/oauth/access_token";

  constructor(private prisma: PrismaService) {}

  async getInstagramAuthUrl(businessId: string): Promise<string> {
    const params = new URLSearchParams({
      client_id: process.env.INSTAGRAM_CLIENT_ID,
      redirect_uri: process.env.INSTAGRAM_REDIRECT_URI,
      state: businessId,
      response_type: "code",
      scope: "instagram_basic,instagram_manage_insights,pages_show_list,pages_read_engagement,instagram_manage_comments"

    });
   
    return `${this.INSTAGRAM_AUTH_URL}?${params.toString()}`;
  }

  async getInstagramTokens(code: string) {
    try {
      console.log("Code reçu :", code);
      const response = await axios.post(this.INSTAGRAM_TOKEN_URL, null, {
        params: {
          client_id: process.env.INSTAGRAM_CLIENT_ID,
          client_secret: process.env.INSTAGRAM_CLIENT_SECRET,
          redirect_uri: process.env.INSTAGRAM_REDIRECT_URI,
          code,
          grant_type: "authorization_code",
        },
      });
      console.log("Tokens reçus :", response.data);
      return response.data;
    } catch (error) {
      console.error("Erreur lors de la récupération des tokens :", error.response?.data || error.message);
      throw new BadRequestException("Erreur lors de la récupération des tokens Instagram");
    }
  }

  async getInstagramUserInfo(code: string, businessId: string) {
    const tokens = await this.getInstagramTokens(code);
    
    try {
      // For basic Instagram accounts
      let response;
      if (tokens.user_id) {
        response = await axios.get(`${this.INSTAGRAM_GRAPH_URL}/me`, {
          params: {
            access_token: tokens.access_token,
            fields: "id,username",
          },
        });
      } else {
        // For business accounts, we need to use Facebook Graph API
        response = await axios.get(`${this.INSTAGRAM_API_URL}/me`, {
          params: {
            access_token: tokens.access_token,
            fields: "id,name,instagram_business_account",
          },
        });
      }
  
      const { id: oauthId, username, name } = response.data;
      const email = username; // Instagram doesn't provide email, so we use username
  
      console.log("Données OAuth reçues :", { oauthId, email, name });
      
      // 1. Get the business and its associated user
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
      });
      
      if (!business) {
        throw new BadRequestException(`Business avec ID ${businessId} non trouvé.`);
      }
      
      // 2. Check if platform already exists
      let existingPlatform = await this.prisma.plateforme.findUnique({
        where: { oauthId },
      });
  
      if (!existingPlatform) {
        // 3. Create platform with the user ID who owns the business
        existingPlatform = await this.prisma.plateforme.create({
          data: {
            provider: "INSTAGRAM",
            oauthId,
            email,
            accessToken: tokens.access_token,
            userId: business.userId,
          },
        });
        console.log("Nouvelle plateforme créée :", existingPlatform);
      }
  
      // 4. Check Business-Platform association
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
  
      return { email, oauthId, name: name || username, accessToken: tokens.access_token, businessId };
    } catch (error) {
      console.error("Erreur lors de la récupération des infos utilisateur Instagram :", error);
      throw new BadRequestException("Impossible de récupérer les infos utilisateur Instagram");
    }
  }

  async fetchInstagramBusinessData(accessToken: string, retryCount = 0): Promise<any> {
    const apiUrl = `${this.INSTAGRAM_API_URL}/me/accounts?fields=instagram_business_account,access_token&access_token=${accessToken}`;
    
    try {
      console.log("🚀 Fetch Instagram Business - Token reçu:", accessToken.substring(0, 10) + "...");
      console.log("🔍 Requête vers :", apiUrl);

      const response = await axios.get(apiUrl);

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers["retry-after"] || "60", 10);
        console.warn(`⏱️ Rate limit atteint, attente de ${retryAfter} secondes...`);

        if (retryCount < 3) {
          await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
          return this.fetchInstagramBusinessData(accessToken, retryCount + 1);
        } else {
          throw new Error("🚨 Trop de tentatives, échec de la récupération !");
        }
      }

      if (!response.data?.data?.length) {
        throw new Error("❌ Aucun compte Business Instagram trouvé.");
      }

      // Find the account with Instagram business account
      const accountWithInstagram = response.data.data.find(
        (account: any) => account.instagram_business_account
      );

      if (!accountWithInstagram) {
        throw new Error("❌ Aucun compte Instagram Business associé trouvé.");
      }

      const accountId = accountWithInstagram.id;
      const instagramAccountId = accountWithInstagram.instagram_business_account.id;
      const pageAccessToken = accountWithInstagram.access_token;

      console.log("🔑 Account ID extrait:", accountId);
      console.log("📸 Instagram Business Account ID extrait:", instagramAccountId);
      console.log("🔐 Page Access Token extrait:", pageAccessToken?.substring(0, 10) + "...");

      return {
        accountId,
        instagramAccountId,
        pageAccessToken,
        rawAccountData: accountWithInstagram,
      };
    } catch (error) {
      console.error("❌ Erreur lors de la récupération des données Instagram Business :", error.message);
      return {
        accountId: null,
        instagramAccountId: null,
        error: error.message,
        errorStack: error.stack,
      };
    }
  }
}