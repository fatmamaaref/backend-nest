import { Controller, Get, Query, Res, BadRequestException } from "@nestjs/common";
import { Response } from "express";

import { PlateformeService } from "src/plateforme/plateforme.service";
import { GoogleService } from "./google.service";
import { BusinessService } from "src/business/business.service";

@Controller("auth")
export class PlateformeController {
  constructor(
    private readonly businessService : BusinessService,
    private readonly plateformeService: PlateformeService,
    private readonly googleService: GoogleService
  ) {}

  @Get("google")
  async googleAuth(@Query("businessId") businessId: string, @Res() res: Response) {
    if (!businessId) {
      throw new BadRequestException("businessId est requis");
    }
  
    const authUrl = await this.googleService.getGoogleAuthUrl(businessId); // Ajout de await
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

  // 🔹 Étape 1 : Récupérer l'utilisateur OAuth2
  const oauthUser = await this.googleService.getGoogleUserInfo(code, businessId);

  // 🔹 Étape 2 : Lier l'utilisateur à la plateforme Google
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

  // 🔹 Étape 3 : Récupérer les données Google My Business
  const { accountId, locationId, pageId } = await this.googleService.fetchGoogleBusinessData(
    oauthUser.accessToken
  );

  // 🔹 Étape 4 : Mettre à jour la plateforme avec accountId
  if (accountId) {
    const updatedPlateforme = await this.plateformeService.updatePlateformeAccountId(plateforme.id, accountId);
    console.log("Plateforme mise à jour avec accountId:", updatedPlateforme);
  }

  // 🔹 Étape 5 : Mettre à jour le business avec locationId et pageId
  if (locationId) {
    const updatedBusiness = await this.businessService.updateBusinessLocation(businessId, locationId, pageId);
    console.log("Business mis à jour avec locationId:", updatedBusiness);
  }

  // 🔹 Étape 6 : Rediriger après succès
  return res.redirect("http://localhost:3000/dashboard");
}

  }
