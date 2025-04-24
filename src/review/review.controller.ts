

import { Body, Controller, Get, Param, Post, HttpCode, HttpStatus,  HttpException, BadRequestException } from '@nestjs/common';
import { ReviewService } from './review.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';



@ApiTags('Reviews')
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


  @Post('analyze-sentiment')
  @HttpCode(HttpStatus.OK)
  async analyzeSentiment(@Body() body: { text: string }) {
    try {
      // Utilisez la méthode publique du service qui appelle la méthode privée
      const result = await this.reviewService.analyzeSentiment(body.text);
      return { 
        success: true,
        sentiment: result
      };
    } catch (error) {
      throw new HttpException(
        'Failed to analyze sentiment',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }


// Ajoutez ces endpoints à votre ReviewController

@Post('respond/:reviewId')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Generate and post response to a review' })
@ApiResponse({ status: 200, description: 'Response generated and posted successfully' })
@ApiResponse({ status: 400, description: 'Invalid request or review not found' })
@ApiResponse({ status: 500, description: 'Failed to process response' })
async respondToReview(@Param('reviewId') reviewId: string) {
  try {
    const result = await this.reviewService.generateAndPostResponse(reviewId);
    
    if (!result.success) {
      throw new BadRequestException('Failed to generate or post response');
    }

    return {
      success: true,
      message: 'Response posted successfully',
      response: result.response
    };
  } catch (error) {
    throw new HttpException(
      error.message || 'Failed to respond to review',
      error instanceof BadRequestException 
        ? HttpStatus.BAD_REQUEST 
        : HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}

@Post('post-response/:reviewId')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Post an existing response to Facebook' })
@ApiResponse({ status: 200, description: 'Response posted successfully' })
@ApiResponse({ status: 400, description: 'Review has no response or Facebook not configured' })
async postExistingResponse(@Param('reviewId') reviewId: string) {
  try {
    const result = await this.reviewService.postFacebookResponse(reviewId);
    
    if (!result.success) {
      throw new BadRequestException(result.message);
    }

    return {
      success: true,
      message: result.message
    };
  } catch (error) {
    throw new HttpException(
      error.message || 'Failed to post response',
      error instanceof BadRequestException 
        ? HttpStatus.BAD_REQUEST 
        : HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}
@Post('generate-response/:reviewId')
@HttpCode(HttpStatus.OK)
async generateResponse(@Param('reviewId') reviewId: string) {
  try {
    console.log(`Requête de génération reçue pour ${reviewId}`); // Debug
    const result = await this.reviewService.respondToReview(reviewId);
    
    if (!result.success) {
      console.log('Échec de génération:', result); // Debug
      throw new BadRequestException('Failed to generate response');
    }

    console.log('Réponse générée avec succès:', result.response); // Debug
    return {
      success: true,
      response: result.response
    };
  } catch (error) {
    console.error('Erreur dans le contrôleur:', error); // Debug
    throw new HttpException(
      error.message || 'Failed to generate response',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }

}


@Post('publish-response/:reviewId')
@HttpCode(HttpStatus.OK)
async publishResponse(@Param('reviewId') reviewId: string) {
  try {
    const result = await this.reviewService.publishResponse(reviewId);
    
    if (!result.success) {
      throw new BadRequestException(result.message);
    }

    return result;
  } catch (error) {
    throw new HttpException(
      error.message || 'Failed to publish response',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}


}