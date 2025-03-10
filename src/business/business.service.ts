import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateBusinessDto } from './dto/create-business.dto';

@Injectable()
export class BusinessService {

  constructor(private prisma: PrismaService) {}

// business.service.ts
async createBusiness(userId: string, createBusinessDto: CreateBusinessDto) {
    const { name, email, phone, address, description, category } = createBusinessDto;
  
    // Création du business sans plateforme pour le moment
    const business = await this.prisma.business.create({
      data: {
        name,
        email,
        phone,
        address,
        description,
        category,
        userId, // L'utilisateur JWT qui a créé le business
      },
    });
  
    return business;
  }

     



/*
  // Créer un business
  async addBusiness(userId: string, plateformeId: string, createBusinessDto: CreateBusinessDto) {
    const { name, email, phone, address, description, category } = createBusinessDto;
  
    return this.prisma.business.create({
      data: {
        name,
        email,
        phone,
        address,
        description,
        category,
        userId,        // Associe le business à l'utilisateur JWT
        plateformeId   // Associe le business à la plateforme utilisée
      },
    });
  }
  
  */
   
  // Récupérer tous les business d'un utilisateur
  async getUserBusinesses(userId: string) {
    const businesses = await this.prisma.business.findMany({
      where: { userId },
    });

    return businesses;
  }

  // Mettre à jour un business
  async updateBusiness(userId: string, businessId: string, updateBusinessDto: any) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business || business.userId !== userId) {
      throw new NotFoundException('Business non trouvé ou non autorisé');
    }

    return this.prisma.business.update({
      where: { id: businessId },
      data: updateBusinessDto,
    });
  }

  // Supprimer un business
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
}
