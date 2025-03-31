import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from 'src/auth/dto/create.user.dto';
import { UpdateUserDto } from 'src/auth/dto/update.user.Dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UsersService { 

constructor(private prisma: PrismaService) {}

 // Créer un utilisateur
 async createUser(createUserDto: CreateUserDto) {
  const { email, password, role, full_name, phone_number, profile_picture } = createUserDto;

  // Hashage du mot de passe
  const hashedPassword = await bcrypt.hash(password, 10);

  // Création de l'utilisateur avec les nouveaux champs
  return this.prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      role,  
      full_name,  
      phone_number,  
      profile_picture, 
    },
    select: {
      id: true,
      email: true,
      role: true,
      full_name: true,
      phone_number: true,
      profile_picture: true,
    },
  });
}
async getAllUsers() {
  return this.prisma.user.findMany({
    select: {
      id: true,
      email: true,
      full_name: true,
      phone_number: true,
      profile_picture: true,
      role: true,
      createdAt: true
    }
  });
}
// Trouver un utilisateur par id
async findById(id:string) {
  return this.prisma.user.findUnique({
    where: {
      id 
    },
    select: {
      id: true,
      email: true,
      role: true,
      full_name: true,
      phone_number: true,
      profile_picture: true,
    },
  });
}



//  Trouver un utilisateur par email
async findByEmail(email: string) {
  return this.prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      password: true, // On garde pour la vérification bcrypt
      role: true,
      full_name: true,
      phone_number: true,
      profile_picture: true,
    },
  });
}

async updateUser(id: string, updateUserDto: UpdateUserDto) {
  if (updateUserDto.password) {
    updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
  }

  const updatedUser = await this.prisma.user.update({
    where: { id },
    data: {
      full_name: updateUserDto.full_name,
      phone_number: updateUserDto.phone_number,
      profile_picture: updateUserDto.profile_picture,
      password: updateUserDto.password || undefined, 
    },
    select: {
      id: true,
      email: true,
      role: true,
      full_name: true,
      phone_number: true,  
      profile_picture: true,
    }
  });

  console.log("Utilisateur mis à jour:", updatedUser);  // Vérifie ce que retourne Prisma
  return updatedUser;
}






// Supprimer un utilisateur
async deleteUser(id:string) {
  return this.prisma.user.delete({
    where: { id },
  });
}

}