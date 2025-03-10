import { IsString, IsOptional, IsEmail } from 'class-validator';

export class UpdateBusinessDto {
  @IsOptional()
  @IsString()
  name?: string;  // Nom de l'entreprise (optionnel)

  @IsOptional()
  @IsEmail()
  email?: string;  // Email du business (optionnel)

  @IsOptional()
  @IsString()
  phone?: string;  // Numéro de téléphone (optionnel)

  @IsOptional()
  @IsString()
  address?: string;  // Adresse physique (optionnel)

  @IsOptional()
  @IsString()
  description?: string;  // Description du business (optionnel)

  @IsOptional()
  @IsString()
  category?: string;  // Catégorie (optionnel)

  @IsOptional()
  @IsString()
  locationId?: string;  // Google Location ID (optionnel)

  @IsOptional()
  @IsString()
  pageId?: string;  // Facebook Page ID (optionnel)

  @IsOptional()
  @IsString()
  userId?: string;  // Lien avec l'utilisateur JWT qui a ajouté ce business (optionnel)

  @IsOptional()
  @IsString()
  platformId?: string;  // Lien avec la plateforme utilisée pour ajouter ce business (optionnel)
}
