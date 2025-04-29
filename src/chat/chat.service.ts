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
      // Validation
      if (!sendMessageDto.content?.trim()) {
        throw new BadRequestException('Message content cannot be empty');
      }

      // Récupération du chat
      const chat = await this.getChatWithAuthorization(
        sendMessageDto.chatId, 
        sendMessageDto.userId
      );

      // Enregistrement du message utilisateur
      await this.createMessage(
        chat.id,
        MessageRole.USER,
        sendMessageDto.content
      );

      // Génération de la réponse AI
      const botResponse = await this.generateAIResponse(
        chat.id,
        sendMessageDto.content
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
      data: { chatId, role, content }
    });
  }


  private getFallbackResponse(messages: Array<{role: string, content: string}>): string {
    const lastMessage = messages[messages.length - 1]?.content || '';
    
    // Réponses prédéfinies selon le contexte
    if (lastMessage.toLowerCase().includes('bonjour')) {
      return "Bonjour ! Je suis actuellement en mode limité. Posez-moi votre question et je répondrai dès que possible.";
    }
    if (lastMessage.toLowerCase().includes('merci')) {
      return "Je vous en prie ! Malheureusement mon service premium est temporairement indisponible.";
    }
    
    return `[Mode dégradé] Votre message a été reçu : "${lastMessage}". Notre service AI est temporairement limité.`;
  }

  private handleError(error: Error, errorId: string) {
    // Amélioration des messages d'erreur
    let userMessage = "Service temporairement indisponible";
    
    if (error.message.includes('Unauthorized access')) {
      userMessage = "Accès non autorisé à ce chat";
    } else if (error.message.includes('Chat not found')) {
      userMessage = "Conversation introuvable";
    }

    return {
      success: false,
      response: userMessage,
      errorId: process.env.NODE_ENV === 'development' ? errorId : undefined
    };
  }




  private async getBusinessData(query: string) {
    return this.prisma.business.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } }
        ]
      },
      include: { reviews: true },
      take: 3
    });
  }
  private async generateAIResponse(chatId: string, userMessage: string): Promise<string> {
    // 1. Récupérer le chat avec toutes les données nécessaires
    const chat = await this.prisma.chat.findUnique({
        where: { id: chatId },
        include: {
            user: {
                include: {
                    businesses: {
                        include: {
                            reviews: true,
                        },
                    },
                },
            },
            messages: {
                orderBy: { timestamp: 'desc' },
                take: 5,
            },
        },
    });

    // 2. Analyser la requête utilisateur
    const businessQuery = this.extractBusinessQuery(userMessage);
    
    // 3. Trouver le business concerné
    const targetBusiness = chat.user.businesses.find(b => 
        b.name.toLowerCase().includes(businessQuery.toLowerCase()) ||
        b.description.toLowerCase().includes(businessQuery.toLowerCase())
    );

    // 4. Préparer la réponse intelligente
    if (targetBusiness) {
        return this.formatBusinessResponse(targetBusiness);
    } else {
        return this.formatBusinessList(chat.user.businesses);
    }
}

private extractBusinessQuery(message: string): string {
    // Extraction plus intelligente du nom du business
    const patterns = [
        /avis sur (.*)/i,
        /infos? (?:pour|sur) (.*)/i,
        /(?:donne|montre).*(?:business|shop|restaurant) (.*)/i
    ];
    
    for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match) return match[1].replace(/[?.!]/g, '').trim();
    }
    
    return message;
}

private formatBusinessList(businesses: any[]): string {
    if (businesses.length === 0) {
        return "Vous n'avez aucun business enregistré. Utilisez /ajouter-business pour commencer.";
    }

    return `Voici vos businesses:\n${businesses.map(b => 
        `🏢 ${b.name} - ${b.reviews.length} avis - /details_${b.id.replace(/-/g, '_')}`
    ).join('\n')}\n\nPosez votre question avec "avis sur [nom]"`;
}

private generateBusinessTip(business: any): string {
    if (business.reviews.length === 0) {
        return "Demandez à vos clients de laisser des avis pour booster votre visibilité!";
    }
    // Ajoutez plus de logique de conseil ici
}


  private async callDeepSeekApi(messages: Array<{role: string, content: string}>) {
    try {
      const apiKey = this.configService.get('DEEPSEEK_API_KEY');
      if (!apiKey) throw new Error('API key missing');
  
      const response = await axios.post(
        this.DEEPSEEK_URL,
        {
          model: 'deepseek-chat',
          messages,
          temperature: 0.3, // Réduire pour des réponses plus factuelles
          max_tokens: 1000
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );
  
      return response.data.choices[0]?.message?.content || 
        this.generateKnowledgeBasedResponse(messages);
      
    } catch (error) {
      this.logger.error('API Error:', error);
      return this.generateKnowledgeBasedResponse(messages);
    }
  }
  
  private generateKnowledgeBasedResponse(messages: any[]): string {
    const lastMessage = messages[messages.length - 1]?.content.toLowerCase() || '';
    
    // Essayez d'extraire le nom du business
    const businessMatch = lastMessage.match(/(?:avis|info|données).*(?:sur|pour|concernant) (.*)/i);
    const businessQuery = businessMatch ? businessMatch[1] : null;
  
    if (businessQuery) {
      return `Je n'ai pas pu accéder à l'IA, mais voici ce que je sais :
      • Votre business "${businessQuery}" est enregistré
      • Utilisez /mes-business pour voir vos établissements
      • /ajouter-avis pour enregistrer des feedbacks`;
    }
  
    return `[Mode expert] Pour une réponse précise, posez votre question comme :
    "Quels sont les avis sur [nom de votre business] ?"
    ou
    "Donnez-moi les statistiques de [nom du business]"`;
  }

  async getUserBusinesses(userId: string) {
    return this.prisma.business.findMany({
      where: { userId },
      select: { id: true, name: true, description: true }
    });
  }

























  

private formatBusinessResponse(business: any): string {
  // Calcul des statistiques avancées
  const stats = {
      totalReviews: business.reviews.length,
      positiveReviews: business.reviews.filter(r => r.rating >= 4).length,
      neutralReviews: business.reviews.filter(r => r.rating === 3).length,
      negativeReviews: business.reviews.filter(r => r.rating < 3).length,
      averageRating: business.reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / business.reviews.length || 0
  };

  // Analyse des sentiments (exemple basique)
  const sentimentAnalysis = this.analyzeSentiments(business.reviews);

  return `**${business.name}**
📍 ${business.description || 'Pas de description'}

📊 Statistiques complètes:
⭐ Note moyenne: ${stats.averageRating.toFixed(1)}/5
🔢 Nombre d'avis: ${stats.totalReviews}
✅ Positifs: ${stats.positiveReviews} | ⚠️ Neutres: ${stats.neutralReviews} | ❌ Négatifs: ${stats.negativeReviews}

📝 Derniers avis:
${business.reviews.slice(0, 3).map(r => 
  `- ${r.rating ? '★'.repeat(r.rating) + '☆'.repeat(5-r.rating) : ''} "${r.message}" ${r.author ? `(${r.author})` : ''}`
).join('\n')}

💡 Analyse: ${sentimentAnalysis || 'Non disponible'}

🔍 Conseils: ${this.generateBusinessTips(stats)}`;
}

private analyzeSentiments(reviews: any[]): string {
  if (reviews.length === 0) return "Pas assez d'avis pour l'analyse";
  
  const keywords = {
      positive: ['bon', 'excellent', 'super', 'génial', 'parfait', 'أحسنت'],
      negative: ['mauvais', 'déçu', 'horrible', 'pire', 'éviter', 'سيء']
  };

  let positiveCount = 0;
  let negativeCount = 0;

  reviews.forEach(review => {
      const text = review.message.toLowerCase();
      if (keywords.positive.some(w => text.includes(w))) positiveCount++;
      if (keywords.negative.some(w => text.includes(w))) negativeCount++;
  });

  return `${positiveCount} avis positifs, ${negativeCount} négatifs`;
}

private generateBusinessTips(stats: any): string {
  const tips = [];
  
  if (stats.totalReviews === 0) {
      return "Demandez à vos clients de laisser des avis !";
  }

  if (stats.averageRating < 3) {
      tips.push("Votre note moyenne est basse, pensez à améliorer votre service");
  }

  if (stats.positiveReviews / stats.totalReviews > 0.7) {
      tips.push("Vos clients sont satisfaits, continuez ainsi !");
  }

  return tips.length > 0 ? tips.join('\n• ') : "Performance moyenne, il y a place à l'amélioration";
}
}




