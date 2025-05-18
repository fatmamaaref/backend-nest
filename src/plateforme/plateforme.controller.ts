import { Controller, Get, Query, Res, BadRequestException } from "@nestjs/common";
import { Response } from "express";

import { PlateformeService } from "src/plateforme/plateforme.service";
import { GoogleService } from "./google.service";
import { FacebookService } from "./facebook.service";
import { BusinessService } from "src/business/business.service";
import { InstagramService } from "./instegram.service";

@Controller("auth")
export class PlateformeController {
  constructor(
    private readonly businessService: BusinessService,
    private readonly plateformeService: PlateformeService,
    private readonly googleService: GoogleService,
    private readonly facebookService: FacebookService,
    private readonly instagramService: InstagramService
  ) {}

  // GOOGLE AUTHENTICATION
  @Get("google")
  async googleAuth(@Query("businessId") businessId: string, @Res() res: Response) {
    if (!businessId) {
      throw new BadRequestException("businessId est requis");
    }
    const authUrl = await this.googleService.getGoogleAuthUrl(businessId);
    return res.redirect(authUrl);
  }

  @Get("google/callback")
  async googleAuthCallback(
    @Query("code") code: string,
    @Query("state") businessId: string,
    @Res() res: Response
  ) {
    if (!code || !businessId) {
      throw new BadRequestException("Code OAuth2 ou businessId manquant");
    }

    const oauthUser = await this.googleService.getGoogleUserInfo(code, businessId);
    const plateforme = await this.plateformeService.linkBusinessToGoogle(
      oauthUser.oauthId,
      oauthUser.email,
      oauthUser.name,
      {
        access_token: oauthUser.accessToken,
        refresh_token: oauthUser.refreshToken,
      },
      oauthUser.businessId
    );

    const { accountId, locationId, pageId } = await this.googleService.fetchGoogleBusinessData(
      oauthUser.accessToken
    );

    if (accountId) {
      await this.plateformeService.updatePlateformeAccountId(plateforme.id, accountId);
    }
    if (locationId) {
      await this.businessService.updateBusinessInfo(businessId, locationId);
    }

    return res.redirect("http://localhost:3000/dashboard");
  }
  // FACEBOOK AUTHENTICATION
  @Get("facebook")
  async facebookAuth(@Query("businessId") businessId: string, @Res() res: Response) {
    if (!businessId) {
      throw new BadRequestException("businessId est requis");
    }
    const authUrl = await this.facebookService.getFacebookAuthUrl(businessId);
    return res.redirect(authUrl);
  }

  @Get("facebook/callback")
async facebookAuthCallback(
  @Query("code") code: string,
  @Query("state") businessId: string,
  @Res() res: Response
) {
  console.log("🚀 Callback Facebook reçu !");
  console.log("Code:", code);
  console.log("Business ID:", businessId);

  if (!code || !businessId) {
    console.error("❌ Erreur: Code OAuth2 ou businessId manquant");
    throw new BadRequestException("Code OAuth2 ou businessId manquant");
  }

  try {
    console.log("🔍 Récupération des infos utilisateur Facebook...");
    const oauthUser = await this.facebookService.getFacebookUserInfo(code, businessId);
    console.log("✅ Utilisateur récupéré :", oauthUser);

    console.log("🔗 Lien avec la plateforme...");
    const plateforme = await this.plateformeService.linkBusinessToFacebook(
      oauthUser.oauthId,
      oauthUser.email,
      oauthUser.name,
      { access_token: oauthUser.accessToken },
      oauthUser.businessId
    );
    console.log("✅ Plateforme mise à jour :", plateforme);

    console.log("📡 Récupération des données Facebook Business...");
    const { accountId, pageId ,pageAccessToken } = await this.facebookService.fetchFacebookBusinessData(
      oauthUser.accessToken
    );

    if (accountId) {
      console.log("💾 Mise à jour Account ID:", accountId);
      await this.plateformeService.updatePlateformeAccountId(plateforme.id, accountId);
    }

    if (pageAccessToken) {
      console.log("💾 Mise à jour Page Access Token:", pageAccessToken?.substring(0, 10) + "...");
      await this.plateformeService.updatePlateformePageAccessToken(plateforme.id, pageAccessToken);
    }

    if (pageId) {
      console.log("💾 Mise à jour Page ID:", pageId);
      await this.businessService.updateBusinessInfo(businessId, pageId);
    }

   // Redirection vers la page des commentaires
   res.redirect(`http://localhost:3000/review/${businessId}`);
  } catch (error) {
    console.error("Erreur Facebook:", error);
    res.redirect(`http://localhost:3000/user-management?error=facebook_error`);
  }
}


 // INSTAGRAM AUTHENTICATION
 @Get("instagram")
 async instagramAuth(@Query("businessId") businessId: string, @Res() res: Response) {
   if (!businessId) {
     throw new BadRequestException("businessId est requis");
   }
   const authUrl = await this.instagramService.getInstagramAuthUrl(businessId);
   return res.redirect(authUrl);
 }

 @Get("instagram/callback")
 async instagramAuthCallback(
   @Query("code") code: string,
   @Query("state") businessId: string,
   @Res() res: Response
 ) {
   console.log("🚀 Callback Instagram reçu !");
   console.log("Code:", code);
   console.log("Business ID:", businessId);

   if (!code || !businessId) {
     console.error("❌ Erreur: Code OAuth2 ou businessId manquant");
     throw new BadRequestException("Code OAuth2 ou businessId manquant");
   }

   try {
     console.log("🔍 Récupération des infos utilisateur Instagram...");
     const oauthUser = await this.instagramService.getInstagramUserInfo(code, businessId);
     console.log("✅ Utilisateur récupéré :", oauthUser);

     console.log("🔗 Lien avec la plateforme...");
     const plateforme = await this.plateformeService.linkBusinessToInstagram(
       oauthUser.oauthId,
       oauthUser.email,
       oauthUser.name,
       { access_token: oauthUser.accessToken },
       oauthUser.businessId
     );
     console.log("✅ Plateforme mise à jour :", plateforme);

     console.log("📡 Récupération des données Instagram Business...");
     const { accountId, instagramAccountId, pageAccessToken } = 
       await this.instagramService.fetchInstagramBusinessData(oauthUser.accessToken);

     if (accountId) {
       console.log("💾 Mise à jour Account ID:", accountId);
       await this.plateformeService.updatePlateformeAccountId(plateforme.id, accountId);
     }

     if (pageAccessToken) {
       console.log("💾 Mise à jour Page Access Token:", pageAccessToken?.substring(0, 10) + "...");
       await this.plateformeService.updatePlateformePageAccessToken(plateforme.id, pageAccessToken);
     }

     if (instagramAccountId) {
       console.log("💾 Mise à jour Instagram Business Account ID:", instagramAccountId);
       await this.businessService.updateBusinessInfo(businessId, instagramAccountId);
     }

     // Redirection vers la page des commentaires
     res.redirect(`http://localhost:3000/review/${businessId}`);
   } catch (error) {
     console.error("Erreur Instagram:", error);
     res.redirect(`http://localhost:3000/user-management?error=instagram_error`);
   }
 }
}
