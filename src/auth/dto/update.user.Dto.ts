import { IsEmail, IsOptional, IsPhoneNumber, IsString, IsUrl, Matches } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  full_name?: string;

  @IsOptional()
  @IsString()
  phone_number?: string;

  @IsOptional()
  @IsString()
  profile_picture?: string;

  @IsOptional()
  @IsString()
  password?: string;

}





