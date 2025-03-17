/*

import { Injectable, BadRequestException } from "@nestjs/common";
import axios from "axios";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class GoogleService {
  private readonly GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
  private readonly GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
  private readonly GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

  constructor(private prisma: PrismaService) {}

  // Générer l'URL d'authentification Google OAuth2.
 

  async getGoogleAuthUrl(businessId: string): Promise<string> {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      response_type: "code",
      scope: "openid email profile https://www.googleapis.com/auth/business.manage",
     
      state: businessId,
      access_type: "offline",
      prompt: "consent",
    });

    return `${this.GOOGLE_AUTH_URL}?${params.toString()}`;
  }


  //Échanger le code OAuth2 contre un token.
  
  async getGoogleTokens(code: string) {
    try {
      console.log("Code reçu :", code);
      const response = await axios.post(
        this.GOOGLE_TOKEN_URL,
        new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: process.env.GOOGLE_REDIRECT_URI,
          grant_type: "authorization_code",
          code,
        }).toString(),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );
      console.log("Tokens reçus :", response.data);
      return response.data;
    } catch (error) {
      console.error("Erreur lors de la récupération des tokens :", error.response?.data || error.message);
      throw new BadRequestException("Erreur lors de la récupération des tokens Google");
    }
  }


  //Récupérer les infos utilisateur après OAuth2 et associer au business.
 
  async getGoogleUserInfo(code: string, businessId: string) {
    const tokens = await this.getGoogleTokens(code);
  
    try {
      // Obtenir les infos de l'utilisateur Google
      const response = await axios.get(this.GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
  
      const { email, id: oauthId, name } = response.data;
  
      console.log("Données OAuth reçues :", { oauthId, email, name });
  
      // Vérifier si l'utilisateur possède déjà cette plateforme
      let existingPlatform = await this.prisma.plateforme.findUnique({
        where: { oauthId },
      });
  
      if (!existingPlatform) {
        try {
          existingPlatform = await this.prisma.plateforme.create({
            data: {
              provider: "GOOGLE",
              oauthId,
              email,
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
              user: {
                connect: { email }, // Assure-toi que l'utilisateur existe déjà
              },
            },
          });
          console.log("Nouvelle plateforme créée :", existingPlatform);
        } catch (error) {
          console.error("Erreur lors de la création de la plateforme :", error);
          throw new BadRequestException("Erreur lors de la création de la plateforme.");
        }
      } else {
        console.log(`Plateforme ${existingPlatform.id} existe déjà.`);
      }
  
      // Vérifier si l'association Business - Plateforme existe déjà
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
      } else {
        console.log(`L'association Business ${businessId} - Plateforme ${existingPlatform.id} existe déjà.`);
      }
  
      return {
        email,
        oauthId,
        name,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        businessId,
      };
    } catch (error) {
      console.error("Erreur lors de la récupération des infos utilisateur Google :", error);
      throw new BadRequestException("Impossible de récupérer les infos utilisateur Google");
    }
  }
  

  async fetchGoogleBusinessData(accessToken: string, retryCount = 0): Promise<any> {
    const accountsUrl = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';
  
    try {
      console.log("🚀 Fetch Google Business Profile - Token reçu:", accessToken.substring(0, 10) + "...");
      console.log("🔍 Requête vers :", accountsUrl);
  
      // Récupération des comptes
      const response = await fetch(accountsUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
  
      // Gestion des limites de taux
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
        console.warn(`⏱️ Rate limit atteint, attente de ${retryAfter} secondes...`);
  
        if (retryCount < 3) { // Max 3 tentatives
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          return this.fetchGoogleBusinessData(accessToken, retryCount + 1);
        } else {
          throw new Error("🚨 Trop de tentatives, échec de la récupération !");
        }
      }
  
      // Vérification de la réponse
      if (!response.ok) {
        throw new Error(`❌ Erreur API Google Business Profile: ${response.status} - ${response.statusText}`);
      }
  
      // Récupération et vérification des données du compte
      const accountsData = await response.json();
      console.log("📊 Données des comptes reçues:", JSON.stringify(accountsData).substring(0, 200) + "...");
  
      if (!accountsData?.accounts?.length) {
        throw new Error("❌ Aucun compte Google Business Profile trouvé.");
      }
  
      // Extraction de l'ID du compte
      const accountIdFull = accountsData.accounts[0].name;
      console.log("🔑 Account ID complet:", accountIdFull);
      
      // Extraction de la partie numérique de l'ID (format "accounts/12345678")
      const accountId = accountIdFull; // Ou utiliser accountIdFull.split('/').pop() si vous avez besoin uniquement du numéro
      console.log("🔑 Account ID extrait:", accountId);
  
      // Construction de l'URL pour récupérer les emplacements
      const locationsUrl = `https://businessprofile.googleapis.com/v1/${accountId}/locations`;
      console.log("🔍 Requête vers :", locationsUrl);
  
      // Récupération des emplacements
      const locationsResponse = await fetch(locationsUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
  
      if (!locationsResponse.ok) {
        console.error("❌ Erreur de réponse locations:", locationsResponse.status, locationsResponse.statusText);
        // Essayer de lire le corps de l'erreur pour plus de détails
        try {
          const errorBody = await locationsResponse.text();
          console.error("Corps de l'erreur:", errorBody);
        } catch (e) {
          console.error("Impossible de lire le corps de l'erreur");
        }
        throw new Error(`❌ Erreur API Google Business Profile Locations: ${locationsResponse.status} - ${locationsResponse.statusText}`);
      }
  
      // Récupération et vérification des données d'emplacement
      const locationsData = await locationsResponse.json();
      console.log("📊 Données des emplacements reçues:", JSON.stringify(locationsData).substring(0, 200) + "...");
  
      if (!locationsData?.locations?.length) {
        throw new Error("❌ Aucun emplacement trouvé pour ce compte.");
      }
  
      // Extraction de l'ID de l'emplacement
      const locationIdFull = locationsData.locations[0].name;
      console.log("📍 Location ID complet:", locationIdFull);
      
      // Extraction de la partie numérique de l'ID (format "accounts/12345678/locations/87654321")
      const locationId = locationIdFull; // Ou extraire différemment selon le format exact
      console.log("📍 Location ID extrait:", locationId);
  
      // Pour débogage, affichons toutes les propriétés importantes
      console.log("📋 Détails du compte:", {
        accountName: accountsData.accounts[0].accountName || 'Non disponible',
        primaryOwner: accountsData.accounts[0].primaryOwner || 'Non disponible',
        type: accountsData.accounts[0].type || 'Non disponible'
      });
  
      console.log("📋 Détails de l'emplacement:", {
        title: locationsData.locations[0].title || 'Non disponible',
        address: locationsData.locations[0].address || 'Non disponible',
        phoneNumber: locationsData.locations[0].phoneNumbers || 'Non disponible'
      });
  
      return { 
        accountId, 
        locationId, 
        pageId: locationId, // Utilisation du même ID pour pageId
        rawAccountData: accountsData.accounts[0],
        rawLocationData: locationsData.locations[0]
      };
    } catch (error) {
      console.error("❌ Erreur lors de la récupération des données Google Business Profile :", error.message);
      console.error("Stack trace:", error.stack);
      return { 
        accountId: null, 
        locationId: null, 
        pageId: null,
        error: error.message,
        errorStack: error.stack
      };
    }
  }
*/



import { Injectable, BadRequestException } from "@nestjs/common";
import axios from "axios";
import { PrismaService } from "src/prisma/prisma.service";
import {OAuth2Client} from "google-auth-library"

@Injectable()
export class GoogleService {
  private readonly GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
  private readonly GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
  private readonly GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

  constructor(private prisma: PrismaService) {}

  async getGoogleAuthUrl(businessId: string): Promise<string> {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      state: businessId,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/business.manage",

      access_type: "offline",
      prompt: "consent",
    });
    return `${this.GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  async getGoogleTokens(code: string) {
    try {
      console.log("Code reçu :", code);
      const response = await axios.post(
        this.GOOGLE_TOKEN_URL,
        new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: process.env.GOOGLE_REDIRECT_URI,
          grant_type: "authorization_code",
          code,
        }).toString(),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );
      console.log("Tokens reçus :", response.data);
      return response.data;
    } catch (error) {
      console.error("Erreur lors de la récupération des tokens :", error.response?.data || error.message);
      throw new BadRequestException("Erreur lors de la récupération des tokens Google");
    }
  }


  //Récupérer les infos utilisateur après OAuth2 et associer au business.
 
  async getGoogleUserInfo(code: string, businessId: string) {
    const tokens = await this.getGoogleTokens(code);
  
    try {
      // Obtenir les infos de l'utilisateur Google
      const response = await axios.get(this.GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
  
      const { email, id: oauthId, name } = response.data;
  
      console.log("Données OAuth reçues :", { oauthId, email, name });
  
      // Vérifier si l'utilisateur possède déjà cette plateforme
      let existingPlatform = await this.prisma.plateforme.findUnique({
        where: { oauthId },
      });
  
      if (!existingPlatform) {
        try {
          existingPlatform = await this.prisma.plateforme.create({
            data: {
              provider: "GOOGLE",
              oauthId,
              email,
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
              user: {
                connect: { email }, // Assure-toi que l'utilisateur existe déjà
              },
            },
          });
          console.log("Nouvelle plateforme créée :", existingPlatform);
        } catch (error) {
          console.error("Erreur lors de la création de la plateforme :", error);
          throw new BadRequestException("Erreur lors de la création de la plateforme.");
        }
      } else {
        console.log(`Plateforme ${existingPlatform.id} existe déjà.`);
      }
  
      // Vérifier si l'association Business - Plateforme existe déjà
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
      } else {
        console.log(`L'association Business ${businessId} - Plateforme ${existingPlatform.id} existe déjà.`);
      }
  
      return {
        email,
        oauthId,
        name,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        businessId,
      };
    } catch (error) {
      console.error("Erreur lors de la récupération des infos utilisateur Google :", error);
      throw new BadRequestException("Impossible de récupérer les infos utilisateur Google");
    }
  }
  




  async fetchGoogleBusinessData(accessToken: string, retryCount = 0): Promise<any> {
    const accountsUrl = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';
    
    try {
      console.log("🚀 Fetch Google Business Profile - Token reçu:", accessToken.substring(0, 10) + "...");
      console.log("🔍 Requête vers :", accountsUrl);

      const response = await fetch(accountsUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
        console.warn(`⏱️ Rate limit atteint, attente de ${retryAfter} secondes...`);

        if (retryCount < 3) {
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          return this.fetchGoogleBusinessData(accessToken, retryCount + 1);
        } else {
          throw new Error("🚨 Trop de tentatives, échec de la récupération !");
        }
      }

      if (!response.ok) {
        throw new Error(`❌ Erreur API Google Business Profile: ${response.status} - ${response.statusText}`);
      }

      const accountsData = await response.json();
      console.log("📊 Données des comptes reçues:", JSON.stringify(accountsData).substring(0, 200) + "...");

      if (!accountsData?.accounts?.length) {
        throw new Error("❌ Aucun compte Google Business Profile trouvé.");
      }

      const accountId = accountsData.accounts[0].name;
      console.log("🔑 Account ID extrait:", accountId);

      const locationsUrl = `https://businessprofile.googleapis.com/v1/${accountId}/locations`;
      console.log("🔍 Requête vers :", locationsUrl);

      const locationsResponse = await fetch(locationsUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!locationsResponse.ok) {
        console.error("❌ Erreur de réponse locations:", locationsResponse.status, locationsResponse.statusText);
        throw new Error(`❌ Erreur API Google Business Profile Locations: ${locationsResponse.status} - ${locationsResponse.statusText}`);
      }

      const locationsData = await locationsResponse.json();
      console.log("📊 Données des emplacements reçues:", JSON.stringify(locationsData).substring(0, 200) + "...");

      if (!locationsData?.locations?.length) {
        throw new Error("❌ Aucun emplacement trouvé pour ce compte.");
      }

      const locationId = locationsData.locations[0].name;
      console.log("📍 Location ID extrait:", locationId);

      return { 
        accountId, 
        locationId, 
        pageId: locationId, 
        rawAccountData: accountsData.accounts[0],
        rawLocationData: locationsData.locations[0]
      };
    } catch (error) {
      console.error("❌ Erreur lors de la récupération des données Google Business Profile :", error.message);
      return { 
        accountId: null, 
        locationId: null, 
        pageId: null,
        error: error.message,
        errorStack: error.stack
      };
    }
  }
}
