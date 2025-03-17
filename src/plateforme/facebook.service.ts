import axios from "axios";
import { Injectable, InternalServerErrorException } from "@nestjs/common";

@Injectable()
export class FacebookService {
  private FACEBOOK_TOKEN_URL = "https://graph.facebook.com/v12.0/oauth/access_token";
  private FACEBOOK_AUTH_URL = "https://www.facebook.com/v12.0/dialog/oauth";

  /**
   * Génère l'URL d'authentification OAuth2 pour Facebook.
   */
  async getFacebookAuthUrl(businessId: string): Promise<string> {
    const params = new URLSearchParams({
      client_id: process.env.FACEBOOK_CLIENT_ID,
      redirect_uri: process.env.FACEBOOK_REDIRECT_URI,
      state: businessId, // Permet de lier l'authentification à un business
      scope: "email,public_profile,pages_show_list",
      response_type: "code",
    });

    return `${this.FACEBOOK_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Échange le code OAuth contre un access_token.
   */
  async getFacebookTokens(code: string): Promise<{ access_token: string; expires_in: number }> {
    try {
      const response = await axios.get(this.FACEBOOK_TOKEN_URL, {
        params: {
          client_id: process.env.FACEBOOK_CLIENT_ID,
          client_secret: process.env.FACEBOOK_CLIENT_SECRET,
          redirect_uri: process.env.FACEBOOK_REDIRECT_URI,
          code,
        },
      });

      return response.data; // { access_token, expires_in }
    } catch (error) {
      console.error("Erreur lors de la récupération du token Facebook:", error.response?.data || error.message);
      throw new InternalServerErrorException("Erreur lors de l'obtention des tokens Facebook.");
    }
  }

  /**
   * Récupère les informations de l'utilisateur Facebook.
   */
  async getFacebookUserInfo(accessToken: string): Promise<{ id: string; name: string; email?: string }> {
    try {
      const response = await axios.get("https://graph.facebook.com/me", {
        params: { fields: "id,name,email" },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      return response.data; // { id, name, email }
    } catch (error) {
      console.error("Erreur lors de la récupération des infos utilisateur Facebook:", error.response?.data || error.message);
      throw new InternalServerErrorException("Impossible de récupérer les informations utilisateur.");
    }
  }
}
