import { Body, Controller, Get, Param, Post, HttpCode, HttpStatus,  HttpException, BadRequestException } from '@nestjs/common';
import { ReviewService } from './review.service';

import { PrismaService } from 'src/prisma/prisma.service';


@Controller('review')
export class ReviewController {
  constructor(
    private readonly reviewService: ReviewService,
    private readonly prisma: PrismaService
  ) {}

  @Post('facebook/sync')
  @HttpCode(HttpStatus.OK)
  async syncFacebookComments(@Body() body: { businessId: string }) {
    try {
      const { businessId } = body;

      // Récupérer la plateforme Facebook associée au business
      const businessPlatform = await this.prisma.businessPlateforme.findFirst({
        where: { 
          businessId,
          plateforme: { provider: 'FACEBOOK' } 
        },
        include: { plateforme: true }
      });

      if (!businessPlatform) {
        throw new BadRequestException('No Facebook account linked to this business');
      }

      const { plateforme } = businessPlatform;
      
      if (!plateforme.accountId || !plateforme.pageAccessToken) {
        throw new BadRequestException('Facebook account not properly configured');
      }

      // Synchroniser les commentaires
      const comments = await this.reviewService.fetchAndSaveAllFacebookComments(
        plateforme.accountId,
        plateforme.pageAccessToken,
        businessId
      );

      return {
        success: true,
        message: `Successfully synced ${comments.length} comments`,
        data: comments
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to sync Facebook comments',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }


  @Get(':businessId')
  async getBusinessReviews(@Param('businessId') businessId: string) {
    console.log(`Fetching reviews for business: ${businessId}`);
    
    try {
      const reviews = await this.prisma.review.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          platformId: true,
          author: true,
          message: true,
          sentiment: true,
          response: true,
          createdAt: true
        }
      });
  
      console.log(`Found ${reviews.length} reviews`);
      return { 
        success: true,
        data: reviews,  // <-- Utilisez toujours 'data' pour la cohérence
        count: reviews.length
      };
    } catch (error) {
      console.error(`Error fetching reviews: ${error.message}`);
      throw new HttpException(
        'Failed to fetch reviews', 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}