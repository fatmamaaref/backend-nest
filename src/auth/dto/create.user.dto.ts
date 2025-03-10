import { Role } from "@prisma/client";
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsPhoneNumber, IsString, IsUrl, Matches, MinLength } from "class-validator";


export class CreateUserDto {

  @IsEmail({}, { message: "L'email n'est pas valide" })
  email: string;

  @IsNotEmpty({ message: "Le mot de passe est obligatoire" })
  @MinLength(6, { message: "Le mot de passe doit contenir au moins 6 caractères" })
  password: string;

  @IsEnum(Role)  // Vérification que le rôle est bien USER ou ADMIN
  role: Role;

  @IsOptional()
  @IsString({ message: "Le nom complet doit être une chaîne de caractères" })
  full_name: string;

  @IsOptional()
  @Matches(/^(\+?\d{1,4}[\s-])?(?:\(?\d{2,3}\)?[\s-]?)?\d{4}[\s-]?\d{4}$/, { message: "Le numéro de téléphone doit être valide" })  // Expression régulière pour numéro de téléphone simple
  phone_number: string;

  @IsOptional()
  profile_picture: string;
}
