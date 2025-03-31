import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { PlateformeService } from 'src/plateforme/plateforme.service';
import axios from 'axios';

@Injectable()
export class BusinessService {
  constructor(private prisma: PrismaService) {}

  async createBusiness(userId: string, createBusinessDto: CreateBusinessDto) {
    console.log('Received DTO:', createBusinessDto); 
    const { name, email, phone, address, description, category, locationId, pageId } = createBusinessDto;
  
    const business = await this.prisma.business.create({
      data: {
        name,
        email,
        phone,
        address,
        description,
        category,
        locationId,
        pageId,
        userId,
      },
    });

    console.log('Created Business:', business);

    return business;
  }

  async findAll(userId: string) {
    return this.prisma.business.findMany({
      where: { userId },
    });
  }

  async updateBusiness(id: string, updateBusinessDto: UpdateBusinessDto, userId: string) {
    const business = await this.prisma.business.findUnique({ where: { id } });
    
    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }
    
    if (business.userId !== userId) {
      throw new ForbiddenException("Vous n'êtes pas autorisé à modifier ce business");
    }
    
    return this.prisma.business.update({
      where: { id },
      data: updateBusinessDto,
    });
  }

  async deleteBusiness(userId: string, businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business || business.userId !== userId) {
      throw new NotFoundException('Business non trouvé ou non autorisé');
    }

    return this.prisma.business.delete({
      where: { id: businessId },
    });
  }



  async updateBusinessInfo(businessId: string, pageId: string ) {
    console.log(`🔄 Mise à jour du business ${businessId} avec :`, pageId);
  
    if (!pageId) {
      console.warn("⚠️  pageId fourni !");
      return;
    }
  
    return this.prisma.business.update({
      where: { id: businessId },
      data: { pageId },
    });
  }
}
