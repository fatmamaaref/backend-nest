import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';

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

  async findAll(userId: string) {
    return this.prisma.business.findMany({
      where: {
        userId, // Récupère seulement les businesses de l'utilisateur connecté
      },
    });
  }

   
   // Mettre à jour un business
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



   
  // Récupérer tous les business d'un utilisateur
  async getUserBusinesses(userId: string) {
    const businesses = await this.prisma.business.findMany({
      where: { userId },
    });

    return businesses;
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
