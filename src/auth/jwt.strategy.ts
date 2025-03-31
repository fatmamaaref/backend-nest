
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    
  
      private readonly usersService: UsersService, 
        configService: ConfigService ) {
      super({
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        ignoreExpiration: false,
        secretOrKey: configService.get<string>('JWT_SECRET'),
      });
    }
  
    async validate(payload: any) {
      console.log('🎯 Payload JWT validé dans JwtStrategy:', payload);
  
      if (!payload.sub) {
        throw new UnauthorizedException('Token invalide (ID utilisateur manquant)');
      }
  
      // Vérifier si l'utilisateur existe dans la base de données
      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('Utilisateur non trouvé');
      }
  
      console.log('✅ Utilisateur retourné par validate:', user); // DEBUG
      return user; // L'utilisateur validé est attaché à la requête
    }
  }
  
  
  
    
