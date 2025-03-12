import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  
      // Cette méthode est appelée après la validation du token JWT
 
  handleRequest(err, user, info) {
    console.log('Vérification du token JWT...');
    
    if (err || !user) {
      throw err || new UnauthorizedException();
    }

    // Assurer que l'ID de l'utilisateur est correctement extrait du JWT

    return { userId: user.id, ...user };
  }

  canActivate(context: ExecutionContext) {
    console.log('Vérification du token JWT...');
    return super.canActivate(context);
  }
}


