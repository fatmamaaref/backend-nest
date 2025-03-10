
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    
    

      private readonly usersService: UsersService,  // Injecte le service utilisateur pour vérifier l'existence
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
  
  
  
    
    
    
    
    
    
    
    
    
    
    
    /*
    
    private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // Le payload contient les données du JWT
    console.log('JWT Payload:', payload); // Vérifie le payload
    return { userId: payload.sub, email: payload.email };
  }
}
*/