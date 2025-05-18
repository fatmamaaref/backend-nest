import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
  private readonly SYSTEM_PROMPT = `
  Vous êtes un assistant expert intégré à une plateforme de gestion d'entreprises.
  Vos connaissances incluent:
  - Toutes les données des entreprises et avis dans notre base de données
  - Bonnes pratiques de gestion commerciale
  - Analyse de performance business

  Règles:
  1. Répondez aux questions générales avec précision
  2. Pour les requêtes business, fournissez des analyses détaillées
  3. Structurez vos réponses avec:
     - Titres clairs
     - Statistiques pertinentes
     - Conseils actionnables
  4. Utilisez les données disponibles lorsque pertinent

  Format de réponse:
  - Questions générales: réponse concise
  - Analyses business: structure détaillée avec stats
  `;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService
  ) {}

  async startChat(createChatDto: CreateChatDto) {
    if (!createChatDto.userId) {
      throw new BadRequestException('User ID is required');
    }

    const userExists = await this.prisma.user.findUnique({
      where: { id: createChatDto.userId }
    });

    if (!userExists) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.chat.create({
      data: { userId: createChatDto.userId }
    });
  }

  async sendMessage(sendMessageDto: SendMessageDto) {
    const errorId = Math.random().toString(36).substring(2, 9);
    
    try {
      if (!sendMessageDto.content?.trim()) {
        throw new BadRequestException('Message content cannot be empty');
      }

      const chat = await this.getChatWithAuthorization(
        sendMessageDto.chatId, 
        sendMessageDto.userId
      );

      await this.createMessage(
        chat.id,
        'USER',
        sendMessageDto.content
      );

      const botResponse = await this.generateAIResponse(
        chat.id,
        sendMessageDto.content,
        sendMessageDto.userId
      );

      await this.createMessage(
        chat.id,
        'ASSISTANT',
        botResponse
      );

      return {
        success: true,
        response: botResponse,
        chatId: chat.id
      };

    } catch (error) {
      this.logger.error(`Error ${errorId}:`, error.stack);
      return this.handleError(error, errorId);
    }
  }

  private async generateAIResponse(chatId: string, userMessage: string, userId: string): Promise<string> {
    const intent = await this.detectIntent(userMessage, userId);
    
    switch(intent.type) {
      case 'LIST_BUSINESSES':
        return this.handleListBusinesses(userId);

      case 'BUSINESS_ANALYSIS':
        return this.handleBusinessRequest(intent.entity, userId);
      
      case 'REVIEW_ANALYSIS':
        return this.handleReviewAnalysis(intent.entity, userId);
      
      case 'DATE_REQUEST':
        return this.handleDateRequest();
      
      case 'GENERAL_QUESTION':
        return this.handleGeneralQuestion(userMessage, userId);
      
      default:
        return this.handleGeneralQuestion(userMessage, userId);
    }
  }

  private async detectIntent(message: string, userId: string): Promise<{type: string, entity?: string}> {
    // Détection de la date
    if (message.toLowerCase().includes("date") || message.toLowerCase().includes("aujourd'hui")) {
        return { type: 'DATE_REQUEST' };
    }

    // Détection des requêtes de liste
    const listPatterns = [
        /(liste|quels sont|affiche|montre).*(mes |mes )?(business|entreprises?)/i,
        /(quelles|quels).*(entreprises?|business)/i
    ];

    // Détection des analyses d'entreprise
    const businessPatterns = [
        /(analyse|détails?|stats?).*(business|entreprise)?\s+(.+)/i,
        /(comment va|performance).*(mon )?(business|entreprise)?\s+(.+)/i,
        /(analyse|détails?)\s+(.+)/i
    ];

    // Détection des analyses d'avis
    const reviewPatterns = [
        /(avis|commentaires?|reviews?).*(pour|de|sur)\s+(.+)/i,
        /(que disent|montre).*(les avis|les commentaires).*(pour|de|sur)\s+(.+)/i
    ];

    // Vérification des patterns
    for (const pattern of listPatterns) {
        if (pattern.test(message)) {
            return { type: 'LIST_BUSINESSES' };
        }
    }

    for (const pattern of businessPatterns) {
        const match = message.match(pattern);
        if (match && (match[3] || match[2])) {
            return { 
                type: 'BUSINESS_ANALYSIS', 
                entity: (match[3] || match[2]).trim() 
            };
        }
    }

    for (const pattern of reviewPatterns) {
        const match = message.match(pattern);
        if (match && (match[3] || match[2])) {
            return { 
                type: 'REVIEW_ANALYSIS', 
                entity: (match[3] || match[2]).trim() 
            };
        }
    }

    // Fallback avec DeepSeek si nécessaire
    try {
        const response = await this.callDeepSeekApi([{
            role: 'user',
            content: `Analyse cette requête et détermine son type:
            1. LIST_BUSINESSES - demande de liste d'entreprises
            2. BUSINESS_ANALYSIS - analyse d'une entreprise spécifique
            3. REVIEW_ANALYSIS - analyse des avis d'une entreprise
            4. DATE_REQUEST - demande de date
            5. GENERAL_QUESTION - question générale
            
            Requête: "${message}"
            
            Réponds en JSON: {type: string, entity?: string}`
        }], userId);
        
        return JSON.parse(response);
    } catch {
        return { type: 'GENERAL_QUESTION' };
    }
  }

  private async handleBusinessRequest(businessQuery: string, userId: string): Promise<string> {
    const cleanedQuery = businessQuery.trim().toLowerCase();
    
    const businesses = await this.prisma.business.findMany({
        where: { userId },
        include: {
            reviews: {
                orderBy: { createdAt: 'desc' },
                take: 5
            }
        }
    });

    // Trouver la meilleure correspondance
    const matchedBusiness = businesses.find(b => 
        b.name.toLowerCase().includes(cleanedQuery) || 
        (b.description && b.description.toLowerCase().includes(cleanedQuery))
    );

    if (!matchedBusiness) {
        const userBusinesses = await this.getUserBusinesses(userId);
        if (userBusinesses.length === 0) {
            return "ℹ️ Vous n'avez aucun business enregistré. Utilisez /ajouter-business pour en créer un.";
        }
        return `Aucun business trouvé pour "${businessQuery}". Voici vos entreprises:\n${
            userBusinesses.map(b => `- ${b.name}`).join('\n')
        }`;
    }

    await this.updateBusinessStats(matchedBusiness.id);
    return this.formatBusinessAnalysis(matchedBusiness);
  }

  private async handleReviewAnalysis(businessQuery: string, userId: string): Promise<string> {
    const cleanedQuery = businessQuery.trim().toLowerCase();
    
    const business = await this.prisma.business.findFirst({
        where: { 
            userId,
            OR: [
                { name: { contains: cleanedQuery, mode: 'insensitive' } },
                { description: { contains: cleanedQuery, mode: 'insensitive' } }
            ]
        },
        include: {
            reviews: {
                orderBy: { createdAt: 'desc' },
                take: 10
            }
        }
    });

    if (!business) {
        const userBusinesses = await this.getUserBusinesses(userId);
        if (userBusinesses.length === 0) {
            return "ℹ️ Vous n'avez aucun business enregistré. Utilisez /ajouter-business pour en créer un.";
        }
        return `Aucun business trouvé pour "${businessQuery}". Voici vos entreprises:\n${
            userBusinesses.map(b => `- ${b.name}`).join('\n')
        }`;
    }

    if (business.reviews.length === 0) {
        return `ℹ️ Aucun avis trouvé pour l'entreprise "${business.name}".`;
    }

    return this.formatReviewAnalysis(business);
  }
  /*
  private formatReviewAnalysis(business: any): string {
    // Normaliser les ratings et filtrer les avis valides
    const validReviews = business.reviews
        .map(r => ({
            ...r,
            rating: typeof r.rating === 'number' ? Math.max(0, Math.min(5, r.rating)) : 0
        }))
        .filter(r => r.message && r.message.trim().length > 0);

    if (validReviews.length === 0) {
        return `ℹ️ Aucun avis valide trouvé pour ${business.name}`;
    }

    // Calculer les statistiques
    const positiveReviews = validReviews.filter(r => r.rating >= 4);
    const negativeReviews = validReviews.filter(r => r.rating <= 2);
    const neutralReviews = validReviews.filter(r => r.rating === 3);

    const totalRating = validReviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = (totalRating / validReviews.length).toFixed(1);

    // Trier les avis négatifs par rating (plus bas d'abord)
    const sortedNegativeReviews = [...negativeReviews].sort((a, b) => a.rating - b.rating);
    
    // Préparer les avis à afficher (max 3)
    const displayReviews = [
        ...sortedNegativeReviews.slice(0, 2),
        ...neutralReviews.slice(0, 1),
        ...positiveReviews.slice(0, 1)
    ].slice(0, 3);

    const formatReview = (r: any) => 
        `- ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)} ${r.rating}/5: ${r.message.trim().substring(0, 50)}${r.message.length > 50 ? '...' : ''}`;

    return `
**Analyse des avis pour ${business.name}**
📊 Statistiques:
${'⭐'} Note moyenne: ${averageRating}/5
${'✅'} Avis positifs (4-5★): ${positiveReviews.length} (${Math.round(positiveReviews.length / validReviews.length * 100)}%)
${'⚠️'} Avis neutres (3★): ${neutralReviews.length} (${Math.round(neutralReviews.length / validReviews.length * 100)}%)
${'❌'} Avis négatifs (0-2★): ${negativeReviews.length} (${Math.round(negativeReviews.length / validReviews.length * 100)}%)

🔍 Exemples d'avis:
${displayReviews.map(formatReview).join('\n')}

💡 Conseils:
${this.generateReviewTips({
    total: validReviews.length,
    positive: positiveReviews.length,
    negative: negativeReviews.length,
    neutral: neutralReviews.length,
    averageRating: parseFloat(averageRating)
})}
`;
}
*/
  private generateReviewTips(stats: any): string {
    if (stats.negative > stats.positive) {
        return "• Plus d'avis négatifs que positifs - analysez les points faibles à améliorer";
    }
    if (stats.averageRating < 3) {
        return "• Note moyenne basse - concentrez-vous sur l'amélioration de la qualité";
    }
    if (stats.total < 5) {
        return "• Peu d'avis - encouragez vos clients à laisser des commentaires";
    }
    return "• Bonne performance globale - continuez à fournir un excellent service";
  }

  private async handleDateRequest(): Promise<string> {
    const today = new Date();
    return `📅 La date d'aujourd'hui est : ${today.toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })}`;
  }

  private async handleGeneralQuestion(question: string, userId: string): Promise<string> {
    // Vérifier d'abord la base de connaissances locale
    const localAnswer = await this.checkLocalKnowledge(question);
    if (localAnswer) return localAnswer;

    // Utiliser DeepSeek pour les autres questions
    try {
        return await this.callDeepSeekApi([
            {
                role: 'system',
                content: this.SYSTEM_PROMPT + '\n\nContexte utilisateur:\n' + 
                    await this.getUserContext(userId)
            },
            {
                role: 'user',
                content: question
            }
        ], userId);
    } catch (error) {
        this.logger.error('Erreur API DeepSeek:', error);
        return `Je n'ai pas pu traiter votre demande. Voici ce que je peux faire:
- Donner la date actuelle
- Lister et analyser vos entreprises
- Analyser les avis de vos entreprises
- Répondre à vos questions business

Exemples:
- "Quelle est la date aujourd'hui ?"
- "Analyse mon entreprise Shop"
- "Montre les avis pour mon restaurant"
- "Liste mes entreprises"`;
    }
  }

  private async checkLocalKnowledge(question: string): Promise<string|null> {
    const knowledgeBase = {
        'date': await this.handleDateRequest(),
        'aujourd\'hui': await this.handleDateRequest(),
        'heure': `Il est ${new Date().toLocaleTimeString('fr-FR')}`,
        'aide': this.getHelpMessage(),
        'help': this.getHelpMessage(),
    };

    const lowerQuestion = question.toLowerCase();
    for (const [key, value] of Object.entries(knowledgeBase)) {
        if (lowerQuestion.includes(key)) {
            return value;
        }
    }
    return null;
  }

  private getHelpMessage(): string {
    return `🆘 **Aide - Commandes disponibles**:
    
📅 **Date et heure**:
- "Quelle est la date aujourd'hui ?"
- "Quelle heure est-il ?"

🏢 **Gestion des entreprises**:
- "Liste mes entreprises"
- "Analyse mon entreprise [nom]"
- "Montre les avis pour [nom entreprise]"

💬 **Questions générales**:
- Posez-moi toute question relative à la gestion d'entreprise
- Demandez des conseils business

ℹ️ Vous pouvez aussi utiliser des commandes comme:
- /liste_entreprises
- /analyse [nom entreprise]
- /avis [nom entreprise]`;
  }

  private async handleListBusinesses(userId: string): Promise<string> {
    const businesses = await this.prisma.business.findMany({
      where: { userId },
      include: {
        reviews: {
          select: {
            rating: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });
  
    if (businesses.length === 0) {
      return "ℹ️ Vous n'avez aucun business enregistré. Utilisez /ajouter-business pour en créer un.";
    }
  
    const formatBusiness = (b) => {
      const stats = this.calculateBusinessStats(b);
      return `🏷️ **${b.name || 'Sans nom'}**\n` +
             `${stats.rating} • 📊 ${stats.reviewCount} avis • 📅 ${stats.lastUpdated}\n` +
             `🔍 \`/details_${b.id.replace(/-/g, '_')}\` • ✏️ \`/analyser_${b.id.replace(/-/g, '_')}\``;
    };
  
    return `📂 **Vos entreprises (${businesses.length})**\n\n` +
           businesses.map(formatBusiness).join('\n\n') +
           `\n\n💡 Pour analyser en détail : \`analyse [nom]\` ou cliquez sur un lien ci-dessus`;
  }

  private calculateBusinessStats(business: any) {
    const validReviews = (business.reviews || []).filter(r => typeof r.rating === 'number' && r.rating >= 0);
    const reviewCount = validReviews.length;
    const hasReviews = reviewCount > 0;
  
    const numericRating = hasReviews 
      ? validReviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
      : 0;
  
    const starCount = hasReviews ? Math.max(1, Math.min(5, Math.round(numericRating))) : 0;
    const stars = '⭐'.repeat(starCount);
    
    const ratingText = hasReviews
      ? `${stars} (${numericRating.toFixed(1)}/5)`
      : `${stars} Pas encore noté`;
  
    return {
      rating: ratingText,
      reviewCount,
      lastUpdated: business.lastAnalyzed
        ? new Date(business.lastAnalyzed).toLocaleDateString('fr-FR') 
        : 'Jamais analysé'
    };
  }

  private async updateBusinessStats(businessId: string) {
    const stats = await this.prisma.review.aggregate({
      where: { businessId },
      _avg: { rating: true },
      _count: true
    });

    await this.prisma.business.update({
      where: { id: businessId },
      data: {
        rating: stats._avg.rating,
        reviewCount: stats._count,
        lastAnalyzed: new Date()
      }
    });
  }

  private formatBusinessAnalysis(business: any): string {
    const stats = {
      rating: business.rating?.toFixed(1) || 'N/A',
      reviews: business.reviewCount || 0,
      lastUpdated: business.lastAnalyzed?.toLocaleDateString('fr-FR') || 'Jamais'
    };

    const recentReviews = (business.reviews || []).slice(0, 3).map(r => 
      `- ${'★'.repeat(r.rating || 0)}${'☆'.repeat(5 - (r.rating || 0))} ${r.message?.substring(0, 50) || ''}${r.message?.length > 50 ? '...' : ''}`
    ).join('\n');

    return `
**Analyse de ${business.name}**
📅 Dernière mise à jour: ${stats.lastUpdated}

📊 Statistiques clés:
⭐ Note moyenne: ${stats.rating}/5
🔢 Nombre d'avis: ${stats.reviews}

🔍 Derniers avis:
${recentReviews || 'Aucun avis récent'}

💡 Conseils:
${this.generateBusinessTips(business)}
`;
  }

  private generateBusinessTips(business: any): string {
    if (!business.reviews || business.reviews.length === 0) {
      return "• Aucun avis disponible - encouragez vos clients à donner leur feedback";
    }

    if (business.rating < 3) {
      return "• Note faible - analysez les avis négatifs pour améliorations";
    }

    return "• Performance satisfaisante - continuez à engager vos clients";
  }

  private async callDeepSeekApi(messages: any[], userId: string, retries = 3): Promise<string> {
    const apiKey = this.configService.get('DEEPSEEK_API_KEY');
    if (!apiKey) {
      this.logger.warn('DeepSeek API key missing, using fallback response');
      return "Je ne peux pas accéder à l'API pour le moment. Voici ce que je peux vous dire:\n" + 
             await this.getLocalResponse(messages[messages.length - 1]?.content, userId);
    }
  
    try {
      const response = await axios.post(
        this.DEEPSEEK_URL,
        {
          model: 'deepseek-chat',
          messages: [
            { 
              role: 'system', 
              content: this.SYSTEM_PROMPT + 
                '\n\nContexte utilisateur:\n' + 
                await this.getUserContext(userId) 
            },
            ...messages
          ],
          temperature: 0.7,
          max_tokens: 2000,
          top_p: 0.9,
          frequency_penalty: 0.2
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 20000
        }
      );
  
      return response.data.choices[0]?.message?.content || "Je n'ai pas pu générer de réponse.";
    } catch (error) {
      if (retries > 0) {
        await new Promise(res => setTimeout(res, 1000));
        return this.callDeepSeekApi(messages, userId, retries - 1);
      }
      this.logger.error('DeepSeek API error:', error);
      return await this.getLocalResponse(messages[messages.length - 1]?.content, userId);
    }
  }

  private async getLocalResponse(question: string, userId: string): Promise<string> {
    const intent = await this.detectIntent(question, userId);
    
    switch(intent.type) {
      case 'LIST_BUSINESSES':
        return this.handleListBusinesses(userId);
      
      case 'BUSINESS_ANALYSIS':
        return this.handleBusinessRequest(intent.entity || '', userId);
      
      case 'REVIEW_ANALYSIS':
        return this.handleReviewAnalysis(intent.entity || '', userId);
      
      case 'DATE_REQUEST':
        return this.handleDateRequest();
      
      default:
        return "Désolé, je ne peux pas accéder à l'API pour le moment. Voici ce que je peux faire:\n" + 
               this.getHelpMessage();
    }
  }
  
  private async getUserContext(userId: string): Promise<string> {
    const userData = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        businesses: {
          select: { 
            name: true,
            description: true,
            rating: true,
            reviewCount: true,
            category: true
          },
          take: 5
        }
      }
    });

    if (!userData) return "Utilisateur non trouvé";

    return `Utilisateur: ${userData.full_name || 'Non spécifié'}
Entreprises: ${userData.businesses?.map(b => 
  `${b.name} (${b.category || 'Non spécifié'}) - ${b.rating || 'N/A'}/5 (${b.reviewCount || 0} avis)`
).join('\n') || 'Aucune entreprise'}`;
  }

  private handleError(error: Error, errorId: string) {
    let userMessage = "Service temporairement indisponible";
    
    if (error instanceof ForbiddenException) {
      userMessage = "Accès non autorisé à ce chat";
    } else if (error instanceof NotFoundException) {
      userMessage = "Conversation introuvable";
    } else if (error.message.includes('timeout')) {
      userMessage = "Le service met trop de temps à répondre. Veuillez réessayer.";
    }

    return {
      success: false,
      response: userMessage,
      errorId: process.env.NODE_ENV === 'development' ? errorId : undefined
    };
  }

  private async getChatWithAuthorization(chatId: string, userId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: { 
        messages: { 
          orderBy: { timestamp: 'asc' }
        } 
      }
    });

    if (!chat) throw new NotFoundException('Chat not found');
    if (chat.userId !== userId) throw new ForbiddenException('Unauthorized access');
    
    return chat;
  }

  private async createMessage(chatId: string, role: MessageRole, content: string) {
    return this.prisma.message.create({
      data: { 
        chatId, 
        role, 
        content
      }
    });
  }

  async getUserBusinesses(userId: string) {
    return this.prisma.business.findMany({
      where: { userId },
      select: { id: true, name: true, description: true }
    });
  }





private formatReviewAnalysis(business: any): string {
  const validReviews = business.reviews
      .map(r => ({
          ...r,
          rating: typeof r.rating === 'number' ? Math.max(0, Math.min(5, r.rating)) : 0,
          sentiment: this.analyzeSentiment(r.message)
      }))
      .filter(r => r.message && r.message.trim().length > 0);

  if (validReviews.length === 0) {
      return `ℹ️ Aucun avis valide trouvé pour ${business.name}`;
  }

  // Calcul des statistiques avancées
  const positiveReviews = validReviews.filter(r => r.rating >= 4);
  const negativeReviews = validReviews.filter(r => r.rating <= 2);
  const neutralReviews = validReviews.filter(r => r.rating === 3);

  // Analyse des sentiments
  const positiveSentiments = validReviews.filter(r => r.sentiment === 'positive').length;
  const negativeSentiments = validReviews.filter(r => r.sentiment === 'negative').length;
  const neutralSentiments = validReviews.filter(r => r.sentiment === 'neutral').length;

  const totalRating = validReviews.reduce((sum, r) => sum + r.rating, 0);
  const averageRating = (totalRating / validReviews.length).toFixed(1);

  // Préparation des mots-clés
  const commonKeywords = this.extractKeywords(validReviews.map(r => r.message));

  return `
**Analyse détaillée des avis pour ${business.name}**
📅 Dernière mise à jour: ${new Date().toLocaleDateString('fr-FR')}

📊 **Statistiques globales:**
⭐ Note moyenne: ${averageRating}/5 (${validReviews.length} avis)
✅ Avis positifs (4-5★): ${positiveReviews.length} (${Math.round(positiveReviews.length / validReviews.length * 100)}%)
⚠️ Avis neutres (3★): ${neutralReviews.length} (${Math.round(neutralReviews.length / validReviews.length * 100)}%)
❌ Avis négatifs (0-2★): ${negativeReviews.length} (${Math.round(negativeReviews.length / validReviews.length * 100)}%)

🎭 **Analyse des sentiments:**
😊 Positif: ${positiveSentiments} (${Math.round(positiveSentiments / validReviews.length * 100)}%)
😐 Neutre: ${neutralSentiments} (${Math.round(neutralSentiments / validReviews.length * 100)}%)
😞 Négatif: ${negativeSentiments} (${Math.round(negativeSentiments / validReviews.length * 100)}%)

🔍 **Mots-clés fréquents:**
${commonKeywords.slice(0, 5).map(k => `- "${k.word}" (${k.count}x)`).join('\n')}

📝 **Derniers avis significatifs:**
${this.getSampleReviews(validReviews)}

💡 **Recommandations stratégiques:**
${this.generateStrategicAdvice({
  averageRating: parseFloat(averageRating),
  positiveCount: positiveReviews.length,
  negativeCount: negativeReviews.length,
  neutralCount: neutralReviews.length,
  positiveSentiments,
  negativeSentiments,
  keywords: commonKeywords
})}
`;
}

private analyzeSentiment(text: string): string {
  const positiveWords = ['bon', 'excellent', 'super', 'génial', 'parfait', 'recommande', 'satisfait'];
  const negativeWords = ['mauvais', 'horrible', 'déçu', 'pire', 'insatisfait', 'décevant'];
  
  const lowerText = text.toLowerCase();
  const positiveMatches = positiveWords.filter(w => lowerText.includes(w)).length;
  const negativeMatches = negativeWords.filter(w => lowerText.includes(w)).length;

  if (positiveMatches > negativeMatches) return 'positive';
  if (negativeMatches > positiveMatches) return 'negative';
  return 'neutral';
}

private extractKeywords(messages: string[]): {word: string, count: number}[] {
  const words = messages
      .flatMap(m => m.split(/\s+/))
      .filter(w => w.length > 3 && !this.isStopWord(w));
  
  const wordCounts: Record<string, number> = {};
  words.forEach(word => {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
  });
  
  return Object.entries(wordCounts)
      .map(([word, count]) => ({word, count}))
      .sort((a, b) => b.count - a.count);
}

private isStopWord(word: string): boolean {
  const stopWords = ['les', 'des', 'une', 'pour', 'avec', 'dans', 'sur'];
  return stopWords.includes(word.toLowerCase());
}

private getSampleReviews(reviews: any[]): string {
  const sorted = [...reviews].sort((a, b) => {
      // Priorise les avis négatifs avec commentaires longs
      if (a.rating <= 2 && a.message.length > 30) return -1;
      if (b.rating <= 2 && b.message.length > 30) return 1;
      return b.message.length - a.message.length;
  });
  
  return sorted.slice(0, 3)
      .map(r => `- ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)} [${r.sentiment === 'positive' ? '😊' : r.sentiment === 'negative' ? '😞' : '😐'}] ${r.message.substring(0, 80)}${r.message.length > 80 ? '...' : ''}`)
      .join('\n');
}

private generateStrategicAdvice(stats: any): string {
  let advice = [];
  
  if (stats.averageRating < 3) {
      advice.push("• **Priorité absolue** : Vos notes moyennes sont préoccupantes. Analysez en détail les avis négatifs pour identifier les problèmes récurrents.");
  } else if (stats.averageRating < 4) {
      advice.push("• **Amélioration possible** : Votre service est correct mais pourrait être amélioré. Concentrez-vous sur les points mentionnés dans les avis neutres.");
  } else {
      advice.push("• **Excellent travail** ! Continuez sur cette lancée en maintenant la qualité de service.");
  }
  
  if (stats.negativeSentiments > stats.positiveSentiments) {
      advice.push("• **Attention au ressenti client** : Même avec des notes correctes, le langage utilisé dans les avis semble plus négatif que positif. Travaillez sur l'expérience client globale.");
  }
  
  if (stats.keywords.some(k => k.word.includes('attente') || k.word.includes('temps'))) {
      advice.push("• **Problème de délais** : Plusieurs clients mentionnent des temps d'attente. Optimisez vos processus ou communiquez mieux sur les délais.");
  }
  
  if (stats.keywords.some(k => k.word.includes('service') || k.word.includes('accueil'))) {
      advice.push("• **Service client** : Ce point est fréquemment mentionné. Une formation supplémentaire de votre équipe pourrait être bénéfique.");
  }
  
  if (advice.length === 1) {
      advice.push("• **Stratégie** : Aucun problème majeur détecté. Concentrez-vous sur l'amélioration continue et la fidélisation client.");
  }
  
  return advice.join('\n');
}


}













































