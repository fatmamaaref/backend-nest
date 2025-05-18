
import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { Cache } from 'cache-manager';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from 'src/prisma/prisma.service';
import { CronJob } from 'cron';

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);
  private readonly DEEPSEEK_API_KEY: string;
  private readonly DEEPSEEK_API_URL = 'https://api.deepseek.com/v1';
  private readonly FACEBOOK_API_VERSION = 'v19.0';

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,

    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly schedulerRegistry: SchedulerRegistry 
  
  ) {
    this.DEEPSEEK_API_KEY = this.configService.get<string>('DEEPSEEK_API_KEY');
    if (!this.DEEPSEEK_API_KEY) {
      throw new Error('DeepSeek API key is not configured');
    }
  }


    
      
       

  async fetchAllFacebookComments(postId: string, pageAccessToken: string, businessId: string) {
    let comments = [];
    let nextPageUrl = `https://graph.facebook.com/v19.0/${postId}/comments?fields=id,from,message,created_time,message_tags&access_token=${pageAccessToken}`;
  
    while (nextPageUrl) {
      try {
        const response = await firstValueFrom(this.httpService.get(nextPageUrl));
          
        comments.push(...response.data.data);
     
        // Pour chaque nouveau commentaire, déclencher la réponse automatique
        for (const comment of response.data.data) {
          const existingReview = await this.prisma.review.findFirst({
            where: { 
              businessId, 
              platformId: comment.id 
            }
          });
  
          if (!existingReview && comment.message) {
            // Démarrer le processus de réponse automatique
            this.handleAutoResponse(comment.id, businessId, comment.message)
              .catch(error => this.logger.error('Auto-response failed', error));
          }
        }
  
        nextPageUrl = response.data.paging?.next || null;
      } catch (error) {
        console.error('Error fetching comments:', error.response?.data || error.message);
        throw new Error('Failed to fetch Facebook comments');
      }
    }
  
    return comments;
  }
   /*
  comments.push(...response.data.data);
  nextPageUrl = response.data.paging?.next || null;
} catch (error) {
  console.error('Error fetching comments:', error.response?.data || error.message);
  throw new Error('Failed to fetch Facebook comments');
}
}

return comments;
}
  */
public async handleAutoResponse(commentId: string, businessId: string, message: string): Promise<void> {
  try {
    // Attendre quelques secondes
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Trouver la review existante au lieu d'en créer une nouvelle
    const review = await this.prisma.review.findFirst({
      where: {
        businessId,
        platformId: commentId
      }
    });

    if (!review) {
      throw new Error(`Review not found for comment ${commentId}`);
    }

    // Générer une réponse seulement si elle n'existe pas déjà
    if (!review.response) {
      const response = await this.generateResponse(review.message, review.sentiment);
      
      await this.prisma.review.update({
        where: { id: review.id },
        data: { response }
      });

      await this.postFacebookResponse(review.id);
      
      this.logger.log(`Auto-response sent for comment ${commentId}`);
    }
  } catch (error) {
    this.logger.error(`Failed to send auto-response for comment ${commentId}`, error);
  }
}


/*
  public async handleAutoResponse(commentId: string, businessId: string, message: string): Promise<void> {
    try {
      // Attendre quelques secondes (par exemple 5 secondes)
      await new Promise(resolve => setTimeout(resolve, 5000));
  
      // Créer la review dans la base de données
      const review = await this.prisma.review.create({
        data: {
          businessId,
          platformId: commentId,
          author: 'Facebook User',
          message,
          createdAt: new Date(),
          sentiment: await this.analyzeSentiment(message)
        }
      });
  
      // Générer une réponse automatique
      const response = await this.generateResponse(review.message, review.sentiment);
      
      // Enregistrer la réponse
      await this.prisma.review.update({
        where: { id: review.id },
        data: { response }
      });
  
      // Poster la réponse sur Facebook
      await this.postFacebookResponse(review.id);
      
      this.logger.log(`Auto-response sent for comment ${commentId}`);
    } catch (error) {
      this.logger.error(`Failed to send auto-response for comment ${commentId}`, error);
    }
  }

*/
















  

  async fetchFacebookPosts(pageId: string, pageAccessToken: string) {
    const url = `https://graph.facebook.com/${this.FACEBOOK_API_VERSION}/${pageId}/posts?fields=id,message,created_time&access_token=${pageAccessToken}`;

    try {
      const response = await firstValueFrom(this.httpService.get(url));
      return response.data.data || [];
    } catch (error) {
      this.logger.error('Error fetching posts', error.response?.data || error.message);
      throw new Error('Failed to fetch Facebook posts');
    }
  }

  /*
  async fetchAndSaveAllFacebookComments(pageId: string, pageAccessToken: string, businessId: string) {
    console.log(`Starting sync for business ${businessId}, page ${pageId}`);
    
    try {
      const posts = await this.fetchFacebookPosts(pageId, pageAccessToken);
      console.log(`Found ${posts.length} posts`);
  
      const allComments = [];
  
      for (const post of posts) {
        try {
          // Ajoutez businessId comme troisième argument
          const comments = await this.fetchAllFacebookComments(post.id, pageAccessToken, businessId);
          console.log(`Found ${comments.length} comments in post ${post.id}`);
          
          for (const comment of comments) {
            const existingReview = await this.prisma.review.findFirst({
              where: { 
                businessId, 
                platformId: comment.id 
              }
            });
  
            if (!existingReview && comment.message) {
              console.log(`Creating new review for comment ${comment.id}`);
              const newReview = await this.prisma.review.create({
                data: {
                  businessId,
                  platformId: comment.id,
                  author: comment.from?.name || comment.from?.username || comment.author || 'Facebook User',
                  message: comment.message,
                  createdAt: new Date(comment.created_time),
                  sentiment: await this.analyzeSentiment(comment.message),
                }
              });
              allComments.push(newReview);
            }
          }
        } catch (postError) {
          console.error(`Error processing post ${post.id}:`, postError);
        }
      }
  
      console.log(`Sync completed. Created ${allComments.length} new comments`);
      return allComments;
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    }
  }
  private async getExistingCommentIds(businessId: string): Promise<Set<string>> {
    const existingReviews = await this.prisma.review.findMany({
      where: { businessId },
      select: { platformId: true }
    });
    return new Set(existingReviews.map(r => r.platformId));
  }

  */

  async fetchAndSaveAllFacebookComments(pageId: string, pageAccessToken: string, businessId: string) {
    console.log(`Starting sync for business ${businessId}, page ${pageId}`);
    
    try {
      const posts = await this.fetchFacebookPosts(pageId, pageAccessToken);
      console.log(`Found ${posts.length} posts`);
  
      const allComments = [];
  
      for (const post of posts) {
        try {
          const comments = await this.fetchAllFacebookComments(post.id, pageAccessToken, businessId);
          console.log(`Found ${comments.length} comments in post ${post.id}`);
          
          for (const comment of comments) {
            const existingReview = await this.prisma.review.findFirst({
              where: { 
                businessId, 
                platformId: comment.id 
              }
            });
  
            if (!existingReview && comment.message) {
              console.log(`Creating new review for comment ${comment.id}`);
              const newReview = await this.prisma.review.create({
                data: {
                  businessId,
                  platformId: comment.id,
                  author: comment.from?.name || comment.from?.username || comment.author || 'Facebook User',
                  message: comment.message,
                  createdAt: new Date(comment.created_time),
                  sentiment: await this.analyzeSentiment(comment.message),
                }
              });
              
              // Ajoutez ici la logique de réponse automatique
              if (newReview) {
                await this.handleAutoResponse(comment.id, businessId, comment.message)
                  .catch(error => this.logger.error('Auto-response failed', error));
              }
              
              allComments.push(newReview);
            }
          }
        } catch (postError) {
          console.error(`Error processing post ${post.id}:`, postError);
        }
      }
  
      console.log(`Sync completed. Created ${allComments.length} new comments`);
      return allComments;
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    }
  }






  private async createReviewFromComment(comment: any, businessId: string) {
    return this.prisma.review.create({
      data: {
        businessId,
        platformId: comment.id,
        author: comment.from?.name || 'Facebook User',
        message: comment.message,
        createdAt: new Date(comment.created_time),
        sentiment: await this.analyzeSentiment(comment.message),
      }
    });
  }

  // ==================== Sentiment Analysis ====================
  public async analyzeSentiment(text: string): Promise<string> {
    if (!text || text.trim().length === 0) return 'neutral';

    const cacheKey = `sentiment:${text}`;
    try {
      const cachedSentiment = await this.cacheManager.get<string>(cacheKey);
      if (cachedSentiment) return cachedSentiment;

      const language = this.detectLanguage(text);
      const prompt = this.createSentimentPrompt(text, language);
      
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.DEEPSEEK_API_URL}/chat/completions`,
          {
            model: 'deepseek-chat',
            messages: [prompt],
            temperature: 0.1,
            max_tokens: 10,
            response_format: { type: "text" }
          },
          {
            headers: {
              'Authorization': `Bearer ${this.DEEPSEEK_API_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        )
      );

      const responseContent = response.data.choices[0]?.message?.content?.trim();
      const sentiment = this.normalizeSentiment(responseContent, language);

      if (!['positive', 'negative', 'neutral'].includes(sentiment)) {
        throw new Error(`Invalid sentiment response: ${responseContent}`);
      }

      await this.cacheManager.set(cacheKey, sentiment, 86400 * 1000);
      return sentiment;

    } catch (error) {
      this.logger.error('Sentiment analysis error', {
        error: error.response?.data || error.message,
        text: text.substring(0, 100)
      });
      
      const language = this.detectLanguage(text);
      return this.fallbackMultilingualAnalysis(text, language);
    }
  }

  // ==================== Response Generation ====================
  private async generateResponse(message: string, sentiment: string): Promise<string> {
    const cacheKey = `response:${sentiment}:${message.substring(0, 50)}`;
    try {
      const cachedResponse = await this.cacheManager.get<string>(cacheKey);
      if (cachedResponse) return cachedResponse;

      const language = this.detectLanguage(message);
      const prompt = this.createResponsePrompt(message, sentiment, language);
      const naturalResponsePrompt = this.createNaturalResponsePrompt(language);

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.DEEPSEEK_API_URL}/chat/completions`,
          {
            model: 'deepseek-chat',
            messages: [prompt, naturalResponsePrompt],
            temperature: 0.7,
            max_tokens: 200,
            frequency_penalty: 0.5,
            presence_penalty: 0.5,
            response_format: { type: "text" }
          },
          {
            headers: {
              'Authorization': `Bearer ${this.DEEPSEEK_API_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 15000
          }
        )
      );

      let generatedResponse = response.data.choices[0]?.message?.content?.trim() || '';
      generatedResponse = this.cleanGeneratedResponse(generatedResponse);
      
      await this.cacheManager.set(cacheKey, generatedResponse, 43200 * 1000);
      return generatedResponse;

    } catch (error) {
      this.logger.error('Failed to generate response', {
        error: error.response?.data || error.message,
        message: message.substring(0, 100),
        sentiment
      });
      return this.getEnhancedFallbackResponse(sentiment, this.detectLanguage(message), message);
    }
  }
/*
  // ==================== Facebook Response Posting ====================
  async postFacebookResponse(reviewId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const review = await this.prisma.review.findUnique({
        where: { id: reviewId },
        include: {
          business: {
            include: {
              businessPlateformes: {
                include: { plateforme: true }
              }
            }
          }
        }
      });

      if (!review) throw new Error('Review not found');
      if (!review.response) throw new Error('No response to post');

      // Handle test comments
      if (review.platformId.startsWith('test-')) {
        return {
          success: true,
          message: 'TEST MODE - Response not actually posted to Facebook'
        };
      }

      const facebookPlatform = review.business.businessPlateformes
        .find(bp => bp.plateforme.provider === 'FACEBOOK')?.plateforme;

      if (!facebookPlatform?.pageAccessToken) {
        throw new Error('Facebook access token not configured');
      }

      // Post to Facebook
      const response = await firstValueFrom(
        this.httpService.post(
          `https://graph.facebook.com/${this.FACEBOOK_API_VERSION}/${review.platformId}/comments`,
          {
            message: review.response,
            access_token: facebookPlatform.pageAccessToken
          }
        )
      );

      // Update review
      await this.prisma.review.update({
        where: { id: reviewId },
        data: { 
          respondedAt: new Date(),
          updatedAt: new Date()
        }
      });

      return { 
        success: true,
        message: 'Response posted successfully on Facebook'
      };
    } catch (error) {
      this.logger.error('Failed to post Facebook response', {
        error: error.response?.data || error.message,
        reviewId
      });
      throw new Error(`Failed to post response: ${error.message}`);
    }
  }
*/
async postFacebookResponse(reviewId: string): Promise<{ success: boolean; message?: string }> {
  try {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        business: {
          include: {
            businessPlateformes: {
              include: { plateforme: true }
            }
          }
        }
      }
    });

    if (!review) throw new Error('Review not found');
    if (!review.response) throw new Error('No response to post');

    // Vérifier si une réponse a déjà été postée
    if (review.respondedAt) {
      return {
        success: false,
        message: 'Response already posted previously'
      };
    }

    // Handle test comments
    if (review.platformId.startsWith('test-')) {
      return {
        success: true,
        message: 'TEST MODE - Response not actually posted to Facebook'
      };
    }

    const facebookPlatform = review.business.businessPlateformes
      .find(bp => bp.plateforme.provider === 'FACEBOOK')?.plateforme;

    if (!facebookPlatform?.pageAccessToken) {
      throw new Error('Facebook access token not configured');
    }

    // Post to Facebook
    const response = await firstValueFrom(
      this.httpService.post(
        `https://graph.facebook.com/${this.FACEBOOK_API_VERSION}/${review.platformId}/comments`,
        {
          message: review.response,
          access_token: facebookPlatform.pageAccessToken
        }
      )
    );

    // Mise à jour atomique avec l'ID de la réponse Facebook
    await this.prisma.review.update({
      where: { id: reviewId },
      data: { 
        respondedAt: new Date(),
      
        updatedAt: new Date()
      }
    });

    return { 
      success: true,
      message: 'Response posted successfully on Facebook'
    };
  } catch (error) {
    this.logger.error('Failed to post Facebook response', {
      error: error.response?.data || error.message,
      reviewId
    });
    throw new Error(`Failed to post response: ${error.message}`);
  }
}






















  // ==================== Scheduled Tasks ====================
  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleNewFacebookComments() {
    this.logger.log('Checking for new Facebook comments...');
    
    const businesses = await this.prisma.business.findMany({
      include: {
        businessPlateformes: {
          include: { plateforme: true }
        }
      }
    });

    for (const business of businesses) {
      const facebookPlatform = business.businessPlateformes.find(
        bp => bp.plateforme.provider === 'FACEBOOK'
      );

      if (!facebookPlatform || !business.pageId || !facebookPlatform.plateforme.pageAccessToken) {
        continue;
      }

      try {
        const newComments = await this.fetchAndSaveAllFacebookComments(
          business.pageId,
          facebookPlatform.plateforme.pageAccessToken,
          business.id
        );

        for (const comment of newComments) {
          await this.processNewComment(comment.id, business.id);
        }
      } catch (error) {
        this.logger.error(`Error processing comments for business ${business.id}`, error);
      }
    }
  }

  private async processNewComment(reviewId: string, businessId: string) {
    try {
      // Wait 5 seconds before responding
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Generate response
      const { success, response } = await this.generateAndPostResponse(reviewId);
      if (!success || !response) {
        throw new Error('Failed to generate response');
      }

      // Post to Facebook
      const postResult = await this.postFacebookResponse(reviewId);
      if (!postResult.success) {
        throw new Error('Failed to post response to Facebook');
      }

      this.logger.log(`Successfully responded to comment ${reviewId}`);

    } catch (error) {
      this.logger.error(`Error processing comment ${reviewId}`, error);
    }
  }

  // ==================== Helper Methods ====================
  private detectLanguage(text: string): 'fr' | 'en' | 'ar' {
    if (!text) return 'en';
    
    const frenchIndicators = [
      /\b(le|la|les|un|une|des|je|tu|il|elle|nous|vous|ils|elles)\b/i,
      /\b(mais|ou|et|donc|or|ni|car)\b/i,
      /(é|è|ê|ë|à|ù|ç)/i
    ];

    if (/[\u0600-\u06FF]/.test(text)) return 'ar';
    if (frenchIndicators.some(indicator => indicator.test(text))) return 'fr';
    return 'en';
  }

  private cleanGeneratedResponse(response: string): string {
    if (!response) return '';
    
    response = response.replace(/^"(.*)"$/, '$1')
                      .replace(/\n+/g, ' ')
                      .trim();

    if (response.length > 0) {
      response = response[0].toUpperCase() + response.slice(1);
    }

    if (!/[.!?]$/.test(response)) {
      response += '.';
    }

    return response;
  }

  // ==================== Prompt Generation ====================
  private createSentimentPrompt(text: string, language: 'fr' | 'en' | 'ar'): { role: string; content: string } {
    const prompts = {
      fr: {
        role: 'system',
        content: `Analyse le sentiment de ce texte (UNIQUEMENT "positive", "negative" ou "neutral"): "${text}"`
      },
      en: {
        role: 'system',
        content: `Analyze sentiment of this text (ONLY respond with "positive", "negative" or "neutral"): "${text}"`
      },
      ar: {
        role: 'system',
        content: `حدد المشاعر (الرد فقط بـ "positive"، "negative" أو "neutral"): "${text}"`
      }
    };
    return prompts[language] || prompts.en;
  }

  private createResponsePrompt(message: string, sentiment: string, language: 'fr' | 'en' | 'ar') {
    const prompts = {
      positive: {
        fr: `Commentaire positif: "${message}". Réponse chaleureuse avec emoji.`,
        en: `Positive comment: "${message}". Warm response with emoji.`,
        ar: `تعليق إيجابي: "${message}". رد دافئ مع إيموجي.`
      },
      negative: {
        fr: `Commentaire négatif: "${message}". Réponse empathique avec solution.`,
        en: `Negative comment: "${message}". Empathetic response with solution.`,
        ar: `تعليق سلبي: "${message}". رد متعاطف مع حل.`
      },
      neutral: {
        fr: `Commentaire neutre: "${message}". Réponse informative.`,
        en: `Neutral comment: "${message}". Informative response.`,
        ar: `تعليق محايد: "${message}". رد معلوماتي.`
      }
    };
    
    return {
      role: 'system',
      content: prompts[sentiment][language] || prompts[sentiment].en
    };
  }

  private createNaturalResponsePrompt(language: 'fr' | 'en' | 'ar') {
    const prompts = {
      fr: {
        role: 'system',
        content: 'Sois naturel comme un humain. Utilise 1-2 emojis max. Sois concis (1-2 phrases).'
      },
      en: {
        role: 'system',
        content: 'Sound natural like a human. Use 1-2 emojis max. Be concise (1-2 sentences).'
      },
      ar: {
        role: 'system',
        content: 'كن طبيعيًا مثل الإنسان. استخدم 1-2 إيموجي كحد أقصى. كن موجزًا (1-2 جمل).'
      }
    };
    return prompts[language] || prompts.en;
  }

  // ==================== Fallback Methods ====================
  private fallbackMultilingualAnalysis(text: string, language: 'fr' | 'en' | 'ar'): string {
    if (!text) return 'neutral';

    const keywords = {
      fr: {
        positive: ['excellent', 'super', 'génial', 'recommande', 'parfait', 'ador', 'bon'],
        negative: ['mauvais', 'déçu', 'horrible', 'nul', 'pas content', 'déteste']
      },
      en: {
        positive: ['excellent', 'great', 'awesome', 'good', 'wonderful', 'love'],
        negative: ['bad', 'poor', 'terrible', 'awful', 'hate', 'disappointed']
      },
      ar: {
        positive: ['ممتاز', 'رائع', 'جميل', 'سعيد', 'جيد'],
        negative:  ['سيء', 'رديء', 'خيبة', 'مخيب', 'غير راض', 'سئ','سيئة','غير جيد']
      }
    };

    const langKeywords = keywords[language] || keywords.en;
    const lowerText = text.toLowerCase();

    if (langKeywords.positive.some(w => lowerText.includes(w))) return 'positive';
    if (langKeywords.negative.some(w => lowerText.includes(w))) return 'negative';
    return 'neutral';
  }

  private getEnhancedFallbackResponse(sentiment: string, language: 'fr' | 'en' | 'ar', originalMessage: string): string {
    const responses = {
      fr: {
        positive: `Merci pour votre commentaire positif ! ${this.extractKeyword(originalMessage, 'fr')} 😊`,
        negative: `Nous sommes désolés pour votre expérience ${this.extractKeyword(originalMessage, 'fr')} 😔`,
        neutral: `Merci pour votre retour ${this.extractKeyword(originalMessage, 'fr')} 👍`
      },
      en: {
        positive: `Thank you for your positive feedback! ${this.extractKeyword(originalMessage, 'en')} 😊`,
        negative: `We're sorry about your experience ${this.extractKeyword(originalMessage, 'en')} 😔`,
        neutral: `Thanks for your feedback ${this.extractKeyword(originalMessage, 'en')} 👍`
      },
      ar: {
        positive: `شكراً لتعليقك الإيجابي! ${this.extractKeyword(originalMessage, 'ar')} 😊`,
        negative: `نحن آسفون لتجربتك ${this.extractKeyword(originalMessage, 'ar')} 😔`,
        neutral: `شكراً لملاحظاتك ${this.extractKeyword(originalMessage, 'ar')} 👍`
      }
    };

    const langResponses = responses[language] || responses.en;
    return langResponses[sentiment] || langResponses.neutral;
  }

  private extractKeyword(text: string, language: string): string {
    const keywords = {
      fr: ["service", "produit", "équipe", "expérience", "accueil"],
      en: ["service", "product", "team", "experience", "welcome"],
      ar: ["الخدمة", "المنتج", "الفريق", "التجربة", "الاستقبال"]
    };
    
    const langKeywords = keywords[language] || keywords.en;
    const found = langKeywords.find(kw => text.toLowerCase().includes(kw));
    return found || (language === 'fr' ? "concernant notre service" : "");
  }

  // ==================== Public Methods ====================
  async getBusinessReviews(businessId: string) {
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
          createdAt: true,
          respondedAt: true
        }
      });

      return { 
        success: true,
        data: reviews,
        count: reviews.length
      };
    } catch (error) {
      this.logger.error('Failed to fetch reviews', error);
      throw error;
    }
  }

  async respondToReview(reviewId: string): Promise<{ success: boolean; response?: string }> {
    try {
      const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
      if (!review) throw new Error('Review not found');

      const response = await this.generateResponse(review.message, review.sentiment);
      
      await this.prisma.review.update({
        where: { id: reviewId },
        data: { 
          response,
          updatedAt: new Date()
        }
      });

      return { success: true, response };
    } catch (error) {
      this.logger.error('Failed to respond to review', error);
      return { success: false };
    }
  }

  async generateAndPostResponse(reviewId: string): Promise<{ success: boolean; response?: string }> {
    try {
      const { success, response } = await this.respondToReview(reviewId);
      if (!success || !response) throw new Error('Failed to generate response');
      
      return { success: true, response };
    } catch (error) {
      this.logger.error('Failed in generateAndPostResponse', error);
      return { success: false };
    }
  }

  async publishResponse(reviewId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const result = await this.postFacebookResponse(reviewId);
      return result;
    } catch (error) {
      this.logger.error('Failed to publish response', error);
      return { success: false, message: error.message };
    }
  }

  // ==================== Test Methods ====================
  async simulateFacebookComment(businessId: string, message: string) {
    return this.prisma.review.create({
      data: {
        businessId,
        platformId: `test-${Date.now()}`,
        author: "Test User",
        message,
        createdAt: new Date(),
        sentiment: await this.analyzeSentiment(message)
      }
    });
  }

  async testAutoRespond(businessId: string, message: string) {
    const testComment = await this.simulateFacebookComment(businessId, message);
    const response = await this.generateResponse(message, 'positive');
    await this.prisma.review.update({
      where: { id: testComment.id },
      data: { response }
    });

    return {
      testCommentId: testComment.id,
      generatedResponse: response,
      publishSimulation: {
        success: true,
        message: 'TEST MODE - Response not actually posted to Facebook'
      }
    };
  }

  private normalizeSentiment(response: string, language: 'fr' | 'en' | 'ar'): string {
    const responseLower = response.toLowerCase();
    
    const positiveKeywords = {
      fr: ['positive', 'positif'],
      en: ['positive'],
      ar: ['positive', 'ايجابي']
    };

    const negativeKeywords = {
      fr: ['negative', 'négatif'],
      en: ['negative'],
      ar: ['negative', 'سلبي']
    };

    if (positiveKeywords[language].some(kw => responseLower.includes(kw))) return 'positive';
    if (negativeKeywords[language].some(kw => responseLower.includes(kw))) return 'negative';

    return 'neutral';
  }


  async startAutoResponder(businessId: string, cronExpression: string = '*/30 * * * * *') {
    const jobName = `auto-responder-${businessId}`;
    
    // Vérifiez et supprimez tout job existant
    try {
      if (this.schedulerRegistry.doesExist('cron', jobName)) {
        const existingJob = this.schedulerRegistry.getCronJob(jobName);
        existingJob.stop();
        this.schedulerRegistry.deleteCronJob(jobName);
      }
    } catch (e) {
      this.logger.warn(`Could not clean up existing job: ${e.message}`);
    }
  
    // Créez et enregistrez le nouveau job
    const job = new CronJob(cronExpression, () => {
      this.checkAndRespondToNewComments(businessId)
        .catch(e => this.logger.error(`Auto-responder error: ${e.message}`));
    });
  
    // Enregistrement CRITIQUE avant le démarrage
    this.schedulerRegistry.addCronJob(jobName, job);
    job.start();
  
    // Vérification immédiate
    const jobs = this.schedulerRegistry.getCronJobs();
    if (!jobs.has(jobName)) {
      throw new Error('Failed to register cron job');
    }
  
    this.logger.log(`Auto-responder started for ${businessId}, next run at ${job.nextDate().toString()}`);
    return { 
      success: true,
      message: `Auto-responder started. Next run: ${job.nextDate().toString()}`
    };
  }


  async stopAutoResponder(businessId: string) {
    try {
      const jobName = `auto-responder-${businessId}`;
      const job = this.schedulerRegistry.getCronJob(jobName);
      job.stop();
      this.schedulerRegistry.deleteCronJob(jobName);
      return { success: true, message: `Auto-responder stopped for business ${businessId}` };
    } catch (error) {
      this.logger.error(`Error stopping auto-responder for business ${businessId}`, error);
      throw error;
    }
  }

  private async checkAndRespondToNewComments(businessId: string) {
    this.logger.debug(`[${new Date().toISOString()}] Checking new comments for ${businessId}`);
    // 1. Récupérer les nouvelles reviews sans réponse
    const unrepliedReviews = await this.prisma.review.findMany({
      where: {
        businessId,
        response: null,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // seulement les dernières 24h
        }
      },
      take: 5 // limite pour éviter de surcharger
    });

    this.logger.log(`Found ${unrepliedReviews.length} unreplied reviews for business ${businessId}`);

    // 2. Pour chaque review, générer et poster une réponse
    for (const review of unrepliedReviews) {
      try {
        // Générer la réponse
        const response = await this.generateResponse(review.message, review.sentiment);
        
        // Enregistrer la réponse dans la base
        await this.prisma.review.update({
          where: { id: review.id },
          data: { response }
        });

        // Poster sur Facebook
        await this.postFacebookResponse(review.id);

        this.logger.log(`Successfully auto-responded to review ${review.id}`);
      } catch (error) {
        this.logger.error(`Failed to auto-respond to review ${review.id}`, error);
      }
    }
  }
  
}
