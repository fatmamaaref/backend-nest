import { BadRequestException, Body, Controller, Get, Post, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginUserDto } from './dto/login.user.dto';
import { CreateUserDto } from './dto/create.user.dto';
import { JwtGuard } from './jwt.guard';

@Controller('auth')
export class AuthController {

  
      constructor(private readonly authService: AuthService) {}
    
      // 🔹 Inscription d'un utilisateur
      @Post('register')
      @UsePipes(new ValidationPipe({ whitelist: true }))
      async register(@Body() createUserDto: CreateUserDto) {
        return this.authService.register(createUserDto);
      }
    
      // 🔹 Connexion et génération du token JWT
      @Post('login')
      @UsePipes(new ValidationPipe({ whitelist: true }))
      async login(@Body() loginUserDto: LoginUserDto) {
        console.log('📥 Requête reçue par le backend:', loginUserDto);
      
        try {
          const response = await this.authService.login(loginUserDto);
          console.log('✅ Réponse du service auth:', response);
          return response;
        } catch (error) {
          console.error('❌ Erreur backend:', error.response || error.message);
          throw new BadRequestException(error.response || 'Erreur inconnue');
        }
      }


// 🔹 Récupérer les informations de l'utilisateur connecté
@UseGuards(JwtGuard)
@Get('me')
getProfile(@Req() req: any) {
  return req.user;
}
  
      
      
      
}
      

   
     
  