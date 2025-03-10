import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
/*
@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
    canActivate(context: ExecutionContext) {
        console.log('CanActivate triggered...');
        return super.canActivate(context); // Assure-toi que la méthode est bien exécutée
    }

    handleRequest(err, user, info) {
        console.log('User extrait du JWT:', user); // Log de l'utilisateur extrait du JWT
        if (err || !user) {
            console.log('Erreur ou utilisateur non trouvé dans le JWT');
            throw new UnauthorizedException('Token invalide ou manquant');
        }
        return user;
    }
}
*/


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









/*
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
    canActivate(context: ExecutionContext) {
        console.log('CanActivate triggered...');
        return super.canActivate(context); // Assure-toi que la méthode est bien exécutée
    }

    handleRequest(err, user, info) {
        console.log('User extrait du JWT:', user);
        if (err || !user) {
          console.log('Erreur ou utilisateur non trouvé dans le JWT');
          throw new UnauthorizedException('Token invalide ou manquant');
        }
        console.log('Utilisateur authentifié:', user); // Log supplémentaire pour valider l'authentification
        return user;
      }
      
}*/