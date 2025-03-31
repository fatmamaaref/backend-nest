import { IsString, IsOptional, IsEmail } from 'class-validator';

export class CreateBusinessDto {
  @IsString()
  name: string;  // Nom de l'entreprise

  @IsEmail()
  email: string;  // Email du business

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
  locationId?: string;

  @IsOptional()
  @IsString()
  pageId?: string;
}

