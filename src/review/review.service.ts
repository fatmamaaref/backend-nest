

import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import {  firstValueFrom} from 'rxjs';
import { PrismaService } from 'src/prisma/prisma.service';


@Injectable()
export class ReviewService {

  private readonly logger = new Logger(ReviewService.name);
  private readonly DEEPSEEK_API_KEY: string;
  private readonly DEEPSEEK_API_URL = 'https://api.deepseek.com/v1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {
    this.DEEPSEEK_API_KEY = this.configService.get<string>('DEEPSEEK_API_KEY');
    if (!this.DEEPSEEK_API_KEY) {
      throw new Error('DeepSeek API key is not configured');
    }
  }











    async fetchAllFacebookComments(postId: string, pageAccessToken: string) {
      let comments = [];
      let nextPageUrl = `https://graph.facebook.com/v19.0/${postId}/comments?fields=id,from,message,created_time,message_tags&access_token=${pageAccessToken}`;
  
      while (nextPageUrl) {
        try {
          const response = await firstValueFrom(this.httpService.get(nextPageUrl));
          comments.push(...response.data.data);
          nextPageUrl = response.data.paging?.next || null;
        } catch (error) {
          console.error('Error fetching comments:', error.response?.data || error.message);
          throw new Error('Failed to fetch Facebook comments');
        }
      }
  
      return comments;
    }
  
    async fetchFacebookPosts(pageId: string, pageAccessToken: string) {
      const url = `https://graph.facebook.com/v19.0/${pageId}/posts?fields=id,message,created_time&access_token=${pageAccessToken}`;
  
      try {
        const response = await firstValueFrom(this.httpService.get(url));
        return response.data.data || [];
      } catch (error) {
        console.error('Error fetching posts:', error.response?.data || error.message);
        throw new Error('Failed to fetch Facebook posts');
      }
    }


    async fetchAndSaveAllFacebookComments(pageId: string, pageAccessToken: string, businessId: string) {
      console.log(`Starting sync for business ${businessId}, page ${pageId}`);
      
      try {
        const posts = await this.fetchFacebookPosts(pageId, pageAccessToken);
        console.log(`Found ${posts.length} posts`);
    
        const allComments = [];
    
        for (const post of posts) {
          try {
            const comments = await this.fetchAllFacebookComments(post.id, pageAccessToken);
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
   
    async getBusinessReviews(businessId: string) {
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
          data: reviews,  
          count: reviews.length
        };
      } catch (error) {
        console.log(`Failed to fetch reviews: ${error.message}`);
        throw error;
      }
    }


 /*

public async analyzeSentiment(text: string): Promise<string> {
  const cacheKey = `sentiment:${text}`;
  
  try {
    // 1. Check cache first
    const cachedSentiment = await this.cacheManager.get<string>(cacheKey);
    if (cachedSentiment && ['positive', 'negative', 'neutral'].includes(cachedSentiment)) {
      return cachedSentiment;
    }

    // 2. Prepare the prompt with examples for better accuracy
    const prompt = {
      role: 'system',
      content: `Analyze the sentiment of this text and respond ONLY with one word: 
      "positive", "negative", or "neutral". Examples:
      - "I love this!" → "positive"
      - "This is terrible" → "negative"
      - "The item is red" → "neutral"
      Text: "${text}"`
    };

    // 3. Call DeepSeek API
    const response = await firstValueFrom(
      this.httpService.post(
        `${this.DEEPSEEK_API_URL}/chat/completions`,
        {
          model: 'deepseek-chat',
          messages: [prompt],
          temperature: 0.1,
          max_tokens: 1,
          response_format: { type: "text" } // Changed from json_object to text
        },
        {
          headers: {
            'Authorization': `Bearer ${this.DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }
      )
    );

    // 4. Process response
    const responseContent = response.data.choices[0]?.message?.content?.toLowerCase().trim();
    let sentiment: string;

    // First try exact matching
    if (['positive', 'negative', 'neutral'].includes(responseContent)) {
      sentiment = responseContent;
    } 
    // Then try partial matching
    else if (responseContent.includes('pos')) {
      sentiment = 'positive';
    } else if (responseContent.includes('neg')) {
      sentiment = 'negative';
    } else {
      sentiment = 'neutral';
    }

    // 5. Validate and cache
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
    
    // Fallback to keyword-based analysis if API fails
    return this.fallbackSentimentAnalysis(text);
  }
}

private fallbackSentimentAnalysis(text: string): string {
  const positiveKeywords = ['excellent', 'super', 'génial', 'recommande', 'parfait', 'ador'];
  const negativeKeywords = ['mauvais', 'déçu', 'horrible', 'nul', 'pas content', 'déteste'];

  const lowerText = text.toLowerCase();
  
  if (positiveKeywords.some(keyword => lowerText.includes(keyword))) {
    return 'positive';
  }
  if (negativeKeywords.some(keyword => lowerText.includes(keyword))) {
    return 'negative';
  }
  return 'neutral';
}

async reanalyzeSentiments(businessId: string, forceAll: boolean = false): Promise<{ count: number }> {
  try {
    // Get reviews to analyze
    const whereClause = forceAll 
      ? { businessId } 
      : { businessId, OR: [{ sentiment: null }, { sentiment: 'neutral' }] };

    const reviews = await this.prisma.review.findMany({
      where: whereClause,
      select: {
        id: true,
        message: true,
        sentiment: true
      }
    });

    this.logger.log(`Starting reanalysis of ${reviews.length} reviews for business ${businessId}`);

    // Process in batches to avoid timeouts
    const batchSize = 10;
    let processed = 0;

    for (let i = 0; i < reviews.length; i += batchSize) {
      const batch = reviews.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (review) => {
        try {
          const newSentiment = await this.analyzeSentiment(review.message);
          
          if (newSentiment !== review.sentiment) {
            await this.prisma.review.update({
              where: { id: review.id },
              data: { sentiment: newSentiment },
            });
            processed++;
          }
        } catch (error) {
          this.logger.error(`Failed to reanalyze review ${review.id}`, error);
        }
      }));

      // Small delay between batches to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.logger.log(`Completed reanalysis. Updated ${processed} reviews for business ${businessId}`);
    return { count: processed };

  } catch (error) {
    this.logger.error(`Failed to reanalyze sentiments for business ${businessId}`, error);
    throw error;
  }
}



*/

public async analyzeSentiment(text: string): Promise<string> {
  const cacheKey = `sentiment:${text}`;
  
  try {
    // 1. Check cache first
    const cachedSentiment = await this.cacheManager.get<string>(cacheKey);
    if (cachedSentiment && ['positive', 'negative', 'neutral'].includes(cachedSentiment)) {
      return cachedSentiment;
    }

    // 2. Detect language and prepare appropriate prompt
    const language = this.detectLanguage(text);
    const prompt = this.createSentimentPrompt(text, language);

    // 3. Call DeepSeek API
    const response = await firstValueFrom(
      this.httpService.post(
        `${this.DEEPSEEK_API_URL}/chat/completions`,
        {
          model: 'deepseek-chat',
          messages: [prompt],
          temperature: 0.1,
          max_tokens: 1,
          response_format: { type: "text" }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }
      )
    );

    // 4. Process response based on language
    const responseContent = response.data.choices[0]?.message?.content?.toLowerCase().trim();
    const sentiment = this.normalizeSentiment(responseContent, language);

    // 5. Validate and cache
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
    
    // Fallback to multilingual keyword analysis if API fails
    return this.fallbackMultilingualAnalysis(text);
  }
}

// Helper method to detect language
private detectLanguage(text: string): 'fr' | 'en' | 'ar' {
  // Simple detection - improve with a library if needed
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';  // Arabic characters
  if (text.match(/\b(le|la|les|un|une|des)\b/i)) return 'fr';  // French articles
  return 'en';  // Default to English
}

// Helper method to create language-specific prompts
private createSentimentPrompt(text: string, language: 'fr' | 'en' | 'ar'): { role: string; content: string } {
  const prompts = {
    fr: {
      role: 'system',
      content: `Analyse le sentiment de ce texte et réponds UNIQUEMENT par un des mots suivants:
      - "positive" si le texte est positif
      - "negative" si le texte est négatif
      - "neutral" si le texte est neutre
      Texte: "${text}"`
    },
    en: {
      role: 'system',
      content: `Analyze the sentiment of this text and respond ONLY with one word:
      - "positive" if the text is positive
      - "negative" if the text is negative
      - "neutral" if the text is neutral
      Text: "${text}"`
    },
    ar: {
      role: 'system',
      content: `حلل المشاعر النصية لهذا النص (أجب فقط بـ "positive"، "negative" أو "neutral"):
      - "positive" إذا كان النص إيجابياً
      - "negative" إذا كان النص سلبياً
      - "neutral" إذا كان النص محايداً
      النص: "${text}"`
    }
  };

  return prompts[language];
}

// Helper method to normalize sentiment response
private normalizeSentiment(response: string, language: 'fr' | 'en' | 'ar'): string {
  const responseLower = response.toLowerCase();

  // Handle all possible language responses
  if (language === 'fr') {
    if (responseLower.includes('positif') || responseLower.includes('positive')) return 'positive';
    if (responseLower.includes('négatif') || responseLower.includes('negative')) return 'negative';
  } 
  else if (language === 'ar') {
    if (responseLower.includes('ايجابي') || responseLower.includes('positive')) return 'positive';
    if (responseLower.includes('سلبي') || responseLower.includes('negative')) return 'negative';
  }
  else { // English
    if (responseLower.includes('positive')) return 'positive';
    if (responseLower.includes('negative')) return 'negative';
  }

  return 'neutral';
}

// Enhanced fallback analysis with multilingual support
private fallbackMultilingualAnalysis(text: string): string {
  // French keywords
  const frenchPositive = ['excellent', 'super', 'génial', 'recommande', 'parfait', 'ador', 'bon', 'formidable'];
  const frenchNegative = ['mauvais', 'déçu', 'horrible', 'nul', 'pas content', 'déteste', 'terrible', 'insatisfait'];

  // English keywords
  const englishPositive = ['excellent', 'great', 'awesome', 'good', 'wonderful', 'happy', 'love'];
  const englishNegative = ['bad', 'poor', 'terrible', 'awful', 'hate', 'disappointed', 'worst'];

  // Arabic keywords
  const arabicPositive = ['ممتاز', 'رائع', 'جميل', 'سعيد', 'جيد', 'حسن'];
  const arabicNegative = ['سيء', 'رديء', 'خيبة', 'مخيب', 'غير راض', 'سئ'];

  const lowerText = text.toLowerCase();
  const language = this.detectLanguage(text);

  if (language === 'fr') {
    if (frenchPositive.some(w => lowerText.includes(w))) return 'positive';
    if (frenchNegative.some(w => lowerText.includes(w))) return 'negative';
  } 
  else if (language === 'ar') {
    if (arabicPositive.some(w => text.includes(w))) return 'positive';
    if (arabicNegative.some(w => text.includes(w))) return 'negative';
  }
  else { // English
    if (englishPositive.some(w => lowerText.includes(w))) return 'positive';
    if (englishNegative.some(w => lowerText.includes(w))) return 'negative';
  }

  return 'neutral';
}































  private async generateResponse(message: string, sentiment: string): Promise<string> {
    const cacheKey = `response:${sentiment}:${message.substring(0, 50)}`;
    try {
      // Vérifier le cache
      const cachedResponse = await this.cacheManager.get<string>(cacheKey);
      if (cachedResponse) {
        return cachedResponse;
      }

      let prompt = '';
      const lang = 'fr'; // Français

      switch(sentiment) {
        case 'positive':
          prompt = `L'utilisateur a écrit ce commentaire positif: "${message}". Réponds avec un remerciement chaleureux et personnalisé en français (environ 2 phrases).`;
          break;
        case 'negative':
          prompt = `L'utilisateur a écrit cette critique: "${message}". Réponds avec des excuses professionnelles, une reconnaissance du problème et une proposition de solution en français (environ 3 phrases).`;
          break;
        default:
          prompt = `L'utilisateur a écrit ce commentaire: "${message}". Réponds de manière neutre, professionnelle et engageante en français (environ 2 phrases).`;
      }

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.DEEPSEEK_API_URL}/chat/completions`,
          {
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 200
          },
          {
            headers: {
              'Authorization': `Bearer ${this.DEEPSEEK_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        )
      );

      const generatedResponse = response.data.choices[0]?.message?.content?.trim() || '';
      
      // Mettre en cache pour 12h
      await this.cacheManager.set(cacheKey, generatedResponse, 43200 * 1000);
      
      return generatedResponse;
    } catch (error) {
      this.logger.error('Failed to generate response', {
        error: error.response?.data || error.message,
        message,
        sentiment
      });
      return 'Nous avons bien pris en compte votre commentaire. Merci !'; // Réponse de secours
    }
  }
  async respondToReview(reviewId: string): Promise<{ success: boolean; response?: string }> {
    try {
      const review = await this.prisma.review.findUnique({
        where: { id: reviewId }
      });

      if (!review) {
        throw new Error('Review not found');
      }

      const response = await this.generateResponse(review.message, review.sentiment);
      
      await this.prisma.review.update({
        where: { id: reviewId },
        data: { response }
      });

      return { success: true, response };
    } catch (error) {
      this.logger.error('Failed to respond to review', error);
      return { success: false };
    }
  }

}
















    
