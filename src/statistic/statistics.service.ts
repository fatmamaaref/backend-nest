import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class StatisticsService {
  constructor(private prisma: PrismaService) {}

  async getBusinessCount(userId: string): Promise<number> {
    return this.prisma.business.count({
      where: { userId },
    });
  }

  async getPlatformCount(userId: string): Promise<number> {
    return this.prisma.plateforme.count({
      where: { userId },
    });
  }

  async getBusinessPlatformLinks(userId: string): Promise<number> {
    return this.prisma.businessPlateforme.count({
      where: {
        business: {
          userId,
        },
      },
    });
  }
}
