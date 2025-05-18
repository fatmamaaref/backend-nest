
import { Body, Controller, Get, Param, Post, HttpCode, HttpStatus,  HttpException, BadRequestException, Logger } from '@nestjs/common';
import { ReviewService } from './review.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { SchedulerRegistry } from '@nestjs/schedule';

@ApiTags('Reviews')
@Controller('review')
export class ReviewController {
  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly reviewService: ReviewService,
    private readonly prisma: PrismaService,

 
  ) {}

  @Get(':businessId')
async getBusinessReviews(@Param('businessId') businessId: string) {
  try {
    return await this.reviewService.getBusinessReviews(businessId);
  } catch (error) {
    throw new HttpException(
      error.message || 'Failed to fetch reviews',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}

  @Post('facebook/sync')
@HttpCode(HttpStatus.OK)
async syncFacebookComments(@Body() body: { businessId: string }) {
  try {
    const { businessId } = body;

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

    // Passez le businessId comme troisième argument
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






























@Post('auto-responder/start/:businessId')
@HttpCode(HttpStatus.OK)
async startAutoResponder(
  @Param('businessId') businessId: string,
  @Body() body: { cronExpression?: string }
) {
  try {
    return await this.reviewService.startAutoResponder(
      businessId, 
      body.cronExpression
    );
  } catch (error) {
    throw new HttpException(
      error.message || 'Failed to start auto-responder',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}

@Post('auto-responder/stop/:businessId')
@HttpCode(HttpStatus.OK)
async stopAutoResponder(@Param('businessId') businessId: string) {
  try {
    return await this.reviewService.stopAutoResponder(businessId);
  } catch (error) {
    throw new HttpException(
      error.message || 'Failed to stop auto-responder',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}

@Get('auto-responder/status/:businessId')
async getAutoResponderStatus(@Param('businessId') businessId: string) {
  const jobName = `auto-responder-${businessId}`;
  
  try {
    // Vérification robuste de l'existence du job
    const jobs = this.schedulerRegistry.getCronJobs();
    if (!jobs.has(jobName)) {
      return { active: false, nextRun: null };
    }

    const job = jobs.get(jobName);
    
    // Solution universelle pour obtenir la date
    let nextRun: string | null = null;
    try {
      const nextDate = job.nextDate();
      if (nextDate) {
        // Conversion compatible avec toutes les versions
        nextRun = typeof nextDate === 'string' 
          ? new Date(nextDate).toISOString()
          : new Date(nextDate.toString()).toISOString();
      }
    } catch (e) {
    console.warn(`Failed to get next run date: ${e.message}`);
    }

    return {
      active: true, // Si le job existe dans le registre, il est actif
      nextRun
    };
  } catch (error) {
console.error(`Status check failed: ${error.message}`);
    return { 
      active: false,
      nextRun: null
    };
  }
}
}






