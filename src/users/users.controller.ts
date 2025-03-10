import { Body, Controller, Delete,Patch, Param,  Post, UseGuards, ValidationPipe, Get, NotFoundException, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';

import { CreateUserDto } from 'src/auth/dto/create.user.dto';
import { UpdateUserDto } from 'src/auth/dto/update.user.Dto';
import { JwtGuard } from 'src/auth/jwt.guard';

@Controller('users') 
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Post()
    async create(@Body() createUserDto: CreateUserDto) {
      return this.usersService.createUser(createUserDto);
    }


    // 🔹 Récupérer les informations d'un utilisateur
    @Get('/:id')
    @UseGuards(JwtGuard) // Protection de la route avec JwtGuard
    async getUser(@Param('id') id:string) {

      const user = await this.usersService.findById(id);
      return user;
    }
    @Get()
    @UseGuards(JwtGuard) // Protection avec JWT
    async getAllUsers() {
      return this.usersService.getAllUsers();
    }
   
  /*
  // 🔹 Mettre à jour un utilisateur
  @Patch(':id')
  @UseGuards(JwtGuard) // Assurez-vous que le token JWT est valide
  async updateUser(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    // Convertir l'ID en nombre
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      throw new BadRequestException('ID utilisateur invalide');
    }
    return this.usersService.updateUser(userId, updateUserDto);
  }
  

  // Supprimer un utilisateur


  @Delete(':id')
  @UseGuards(JwtGuard) // Utilisation de JwtGuard pour vérifier le token
  async deleteUser(@Param('id') id: string) {
    // Convertir l'id en nombre
    const userId = parseInt(id, 10); // S'assurer que l'id est bien un nombre
    if (isNaN(userId)) {
      throw new BadRequestException('ID utilisateur invalide');
    }
    await this.usersService.deleteUser(userId);
    return { message: 'Utilisateur supprimé avec succès' };
  }


*/




  @Patch(':id')
  @UseGuards(JwtGuard)
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto
  ) {
    return this.usersService.updateUser(id, updateUserDto);
  }



// 🔹 Supprimer un utilisateur
@Delete(':id')
@UseGuards(JwtGuard)
async deleteUser(@Param('id') id: string) {
  await this.usersService.deleteUser(id);
  return { message: 'Utilisateur supprimé avec succès' };
}

  






}
 
 

 
