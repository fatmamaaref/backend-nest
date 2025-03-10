import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import { LoginUserDto } from './dto/login.user.dto';
import { CreateUserDto } from './dto/create.user.dto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuthService {

    constructor(
        private readonly usersService: UsersService,  // Injection de UsersService
        private readonly jwtService: JwtService,
        private readonly prisma: PrismaService
      ) {}


      // 🔹 Inscription d'un utilisateur
      async register(data: CreateUserDto) {
        return this.usersService.createUser(data);
      }
    
      // 🔹 Connexion et génération du token JWT
      async login(data: LoginUserDto) {
        const user = await this.usersService.findByEmail(data.email);
        if (!user || !(await bcrypt.compare(data.password, user.password))) {
          throw new UnauthorizedException('Email ou mot de passe incorrect');
        }
    
        const payload = { sub: user.id, email: user.email, role: user.role };
        return {
          access_token: this.jwtService.sign(payload),
        };
      }

      async findUserById(userId: string) {
        return this.prisma.user.findUnique({ where: { id: userId } });
      }
    }
    