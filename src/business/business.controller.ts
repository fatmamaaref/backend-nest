
import { BusinessService } from './business.service';
import {  Body, Controller, Delete,Request, Get, Param, Post, Put, Req, UseGuards} from '@nestjs/common';

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
    


    
   /*
    
     @Get('all')
     @UseGuards(JwtGuard)
     async getUserBusinesses(@Req() req: Request , @Body( ) body) {
       const userId = body.user?.userId; // Vérifier si req.user est défini
     if (!userId) {
     throw new Error('Utilisateur non trouvé dans le token JWT');
        }
     return this.businessService.getUserBusinesses(userId); // Récupérer les businesses de l'utilisateur
    }
   
      @Put('update/:businessId')
     @UseGuards(JwtGuard)
     async updateBusiness(
    @Req() req: Request,
     @Param('businessId') businessId: string,
     @Body() updateBusinessDto: UpdateBusinessDto
    ) {
     const userId = req.user?.userId; // Vérifier si req.user est défini
     if (!userId) {
      throw new Error('Utilisateur non trouvé dans le token JWT');
       }
    return this.businessService.updateBusiness(userId, businessId, updateBusinessDto); // Mettre à jour le business
    }
   
     
    @Delete('delete/:businessId')
      @UseGuards(JwtGuard)
      async deleteBusiness(@Req() req: Request, @Param('businessId') businessId: string) {
      const userId = req.user?.userId; // Vérifier si req.user est défini
      if (!userId) {
        throw new Error('Utilisateur non trouvé dans le token JWT');
       }
        return this.businessService.deleteBusiness(userId, businessId); // Supprimer le business
      }
   
   */
   }
