
import { BusinessService } from './business.service';
import {  Body, Controller, Delete,Request, Get, Param, Post, Put, Req, UseGuards, BadRequestException, UnauthorizedException} from '@nestjs/common';

import { JwtGuard } from 'src/auth/jwt.guard';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';


@Controller('business')
export class BusinessController {

    constructor(private readonly businessService: BusinessService) {}

    @Post()
    @UseGuards(JwtGuard)
    async createBusiness(@Req() req, @Body() createBusinessDto: CreateBusinessDto) {
      const userId = req.user.userId; // Extrait l'utilisateur du JWT
      const business = await this.businessService.createBusiness(userId, createBusinessDto);
      return business;
    }
    
    @UseGuards(JwtGuard)
    @Get('all')
    async getAllBusinesses(@Req() req) {
      const userId = req.user.id; // Récupérer l'ID de l'utilisateur connecté
      return this.businessService.findAll(userId);
    }
 
   
    @Put('/update/:id')
    @UseGuards(JwtGuard)
    async updateBusiness(
      @Param('id') id: string,
      @Body() updateBusinessDto: UpdateBusinessDto,
      @Req() req
    ) {
      console.log('🔍 User:', req.user); // Vérifier si req.user est bien défini
      console.log('📦 Body:', updateBusinessDto); // Vérifier si le body est bien reçu
    
      if (!req.user) {
        throw new UnauthorizedException("Utilisateur non authentifié");
      }
    
      const userId = req.user.id;
    
      if (!id) {
        throw new BadRequestException("L'ID du business est manquant");
      }
    
      return this.businessService.updateBusiness(id, updateBusinessDto, userId);
    }
    
    




/*
@Post('add')
@UseGuards(JwtGuard) // S'assurer que le guard est bien utilisé
async addBusiness(@Req() req, @Body() createBusinessDto: CreateBusinessDto) {
  console.log('🔍 Utilisateur reçu dans la route:', req.user);

  if (!req.user) {
    throw new UnauthorizedException("Utilisateur non authentifié");
  }

  return this.businessService.createBusiness(req.user.id, createBusinessDto);
}

*/

    @Delete('delete/:id')
    @UseGuards(JwtGuard)
    async deleteBusiness(@Req() req, @Param('id') businessId: string) {
    const userId = req.user?.userId; // Vérifier si req.user est défini
    if (!userId) {
      throw new Error('Utilisateur non trouvé dans le token JWT');
     }
      return this.businessService.deleteBusiness(userId, businessId); // Supprimer le business
    }

  
   }

