

import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
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


  // Ajoutez ces méthodes à votre ReviewService

async postFacebookResponse(reviewId: string): Promise<{ success: boolean; message?: string }> {
  try {
    // 1. Récupérer la review avec toutes les informations nécessaires
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

    if (!review) {
      throw new Error('Review not found');
    }

    if (!review.response) {
      throw new Error('No response generated for this review');
    }

    // 2. Trouver la plateforme Facebook
    const facebookPlatform = review.business.businessPlateformes
      .find(bp => bp.plateforme.provider === 'FACEBOOK')?.plateforme;

    if (!facebookPlatform?.pageAccessToken) {
      throw new Error('Facebook access token not configured');
    }

    // 3. Poster la réponse sur Facebook
    const response = await firstValueFrom(
      this.httpService.post(
        `https://graph.facebook.com/v19.0/${review.platformId}/comments`,
        {
          message: review.response,
          access_token: facebookPlatform.pageAccessToken
        }
      )
    );

    // 4. Mettre à jour la review pour indiquer qu'elle a été répondue
    await this.prisma.review.update({
      where: { id: reviewId },
      data: {  updatedAt: new Date() }
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

async generateAndPostResponse(reviewId: string): Promise<{ success: boolean; response?: string }> {
  try {
    // 1. Générer la réponse adaptée
    const { success, response } = await this.respondToReview(reviewId);
    if (!success || !response) {
      throw new Error('Failed to generate response');
    }

    // 2. Poster la réponse sur Facebook
    const { success: postSuccess } = await this.postFacebookResponse(reviewId);
    
    return { 
      success: postSuccess, 
      response 
    };
  } catch (error) {
    this.logger.error('Failed in generateAndPostResponse', error);
    return { success: false };
  }
}




}











/*

private async generateResponse(message: string, sentiment: string): Promise<string> {
  const cacheKey = `response:${sentiment}:${message.substring(0, 50)}`;
  try {
      // Vérifier le cache
      const cachedResponse = await this.cacheManager.get<string>(cacheKey);
      if (cachedResponse) {
          return cachedResponse;
      }

      // Détecter la langue du commentaire
      const language = this.detectLanguage(message);
      let prompt = '';

      // Créer le prompt en fonction du sentiment et de la langue
      switch(sentiment) {
          case 'positive':
              prompt = this.createPositiveResponsePrompt(message, language);
              break;
          case 'negative':
              prompt = this.createNegativeResponsePrompt(message, language);
              break;
          default:
              prompt = this.createNeutralResponsePrompt(message, language);
      }

      // Appeler l'API DeepSeek
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
                  },
                  timeout: 10000
              }
          )
      );

      const generatedResponse = response.data.choices[0]?.message?.content?.trim() || '';
      
      // Nettoyer et formater la réponse
      const cleanedResponse = this.cleanGeneratedResponse(generatedResponse, language);
      
      // Mettre en cache pour 12h
      await this.cacheManager.set(cacheKey, cleanedResponse, 43200 * 1000);
      
      return cleanedResponse;
  } catch (error) {
      this.logger.error('Failed to generate response', {
          error: error.response?.data || error.message,
          message,
          sentiment
      });
      return this.getFallbackResponse(message, sentiment, this.detectLanguage(message));
  }
}

// Méthodes helper pour créer les prompts
private createPositiveResponsePrompt(message: string, language: 'fr' | 'en' | 'ar'): string {
  const prompts = {
      fr: `L'utilisateur a écrit ce commentaire positif: "${message}". 
          Réponds en français avec:
          1. Un remerciement chaleureux et personnalisé
          2. Une mention spécifique à leur expérience positive
          3. Une invitation à revenir
          Exemple: "Merci beaucoup pour votre commentaire enthousiaste ! Nous sommes ravis que vous ayez apprécié [détail spécifique]. Au plaisir de vous revoir bientôt !"`,
      en: `The user wrote this positive comment: "${message}".
          Respond in English with:
          1. A warm and personalized thank you
          2. Specific mention of their positive experience
          3. An invitation to return
          Example: "Thank you so much for your enthusiastic feedback! We're thrilled you enjoyed [specific detail]. Looking forward to seeing you again soon!"`,
      ar: `كتب المستخدم هذا التعليق الإيجابي: "${message}".
          رد باللغة العربية مع:
          1. شكر دافئ ومخصص
          2. ذكر محدد لتجربتهم الإيجابية
          3. دعوة للعودة
          مثال: "شكراً جزيلاً على تعليقك المتحمس! نحن سعداء أنك استمتعت بـ [تفصيل محدد]. نتطلع لرؤيتك مجدداً قريباً!"`
  };
  return prompts[language];
}

private createNegativeResponsePrompt(message: string, language: 'fr' | 'en' | 'ar'): string {
  const prompts = {
      fr: `L'utilisateur a écrit cette critique: "${message}".
          Réponds en français avec:
          1. Des excuses sincères et professionnelles
          2. Une reconnaissance du problème spécifique
          3. Une proposition de solution ou de compensation
          4. Une invitation à discuter en privé si nécessaire
          Exemple: "Nous sommes sincèrement désolés pour votre expérience décevante concernant [détail]. Nous prenons cela très au sérieux et aimerions [solution proposée]. N'hésitez pas à nous contacter en privé pour en discuter."`,
      en: `The user wrote this negative review: "${message}".
          Respond in English with:
          1. Sincere and professional apologies
          2. Acknowledgment of the specific issue
          3. Proposed solution or compensation
          4. Invitation to discuss privately if needed
          Example: "We're truly sorry for your disappointing experience regarding [detail]. We take this very seriously and would like to [proposed solution]. Please feel free to contact us privately to discuss this further."`,
      ar: `كتب المستخدم هذا التعليق السلبي: "${message}".
          رد باللغة العربية مع:
          1. اعتذار صادق ومحترف
          2. الاعتراف بالمشكلة المحددة
          3. حل مقترح أو تعويض
          4. دعوة للنقاش بشكل خاص إذا لزم الأمر
          مثال: "نحن نعتذر بصدق عن تجربتك المخيبة للآمال فيما يخص [تفصيل]. نأخذ هذا الأمر على محمل الجد ونسعى إلى [حل مقترح]. لا تتردد في الاتصال بنا بشكل خاص لمناقشة هذا الأمر."`
  };
  return prompts[language];
}

private createNeutralResponsePrompt(message: string, language: 'fr' | 'en' | 'ar'): string {
  const prompts = {
      fr: `L'utilisateur a écrit ce commentaire: "${message}".
          Réponds en français avec:
          1. Un remerciement pour le commentaire
          2. Une réponse pertinente au contenu
          3. Une invitation à échanger davantage si besoin
          Exemple: "Merci pour votre commentaire concernant [sujet]. Nous avons noté votre remarque sur [détail]. N'hésitez pas à nous contacter si vous souhaitez plus d'informations."`,
      en: `The user wrote this comment: "${message}".
          Respond in English with:
          1. Thank you for the feedback
          2. Relevant response to the content
          3. Invitation to engage further if needed
          Example: "Thank you for your comment regarding [topic]. We've noted your remark about [detail]. Feel free to reach out if you'd like more information."`,
      ar: `كتب المستخدم هذا التعليق: "${message}".
          رد باللغة العربية مع:
          1. شكراً على التعليق
          2. رد ذو صلة بالمحتوى
          3. دعوة للتواصل أكثر إذا لزم الأمر
          مثال: "شكراً لك على تعليقك بخصوص [الموضوع]. لقد لاحظنا ملاحظتك حول [تفصيل]. لا تتردد في التواصل إذا كنت ترغب في المزيد من المعلومات."`
  };
  return prompts[language];
}

// Nettoyer la réponse générée
private cleanGeneratedResponse(response: string, language: 'fr' | 'en' | 'ar'): string {
  // Supprimer les guillemets s'ils entourent toute la réponse
  response = response.replace(/^"(.*)"$/, '$1');
  
  // Supprimer les sauts de ligne inutiles
  response = response.replace(/\n+/g, ' ').trim();
  
  // Capitaliser la première lettre
  if (response.length > 0) {
      response = response[0].toUpperCase() + response.slice(1);
  }
  
  // Ajouter un point final si absent
  if (!/[.!?]$/.test(response)) {
      response += '.';
  }
  
  return response;
}

// Réponse de secours
private getFallbackResponse(message: string, sentiment: string, language: 'fr' | 'en' | 'ar'): string {
  const responses = {
      fr: {
          positive: "Merci beaucoup pour votre commentaire positif ! Nous sommes ravis de votre satisfaction.",
          negative: "Nous sommes désolés pour votre expérience. Nous prenons votre commentaire très au sérieux et allons examiner ce point.",
          neutral: "Merci pour votre commentaire. Nous avons bien pris note de votre retour."
      },
      en: {
          positive: "Thank you for your positive feedback! We're delighted you're satisfied.",
          negative: "We're sorry about your experience. We take your feedback very seriously and will look into this.",
          neutral: "Thank you for your comment. We've noted your feedback."
      },
      ar: {
          positive: "شكراً لك على تعليقك الإيجابي! نحن سعداء برضاك.",
          negative: "نحن نأسف لتجربتك. نأخذ ملاحظتك على محمل الجد وسنبحث في هذا الأمر.",
          neutral: "شكراً لك على تعليقك. لقد أخذنا ملاحظتك بعين الاعتبار."
      }
  };
  return responses[language][sentiment] || responses[language]['neutral'];
}

}
*/