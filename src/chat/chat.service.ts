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

  private async generateAIResponse(chatId: string, newMessage: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: { messages: true }
    });

    const apiMessages = chat.messages.map(m => ({
      role: m.role === MessageRole.USER ? 'user' : 'assistant',
      content: m.content
    }));

    apiMessages.push({ role: 'user', content: newMessage });

    const botResponse = await this.callDeepSeekApi(apiMessages);
    
    await this.createMessage(
      chatId,
      MessageRole.ASSISTANT,
      botResponse
    );

    return botResponse;
  }

  private async callDeepSeekApi(messages: Array<{role: string, content: string}>) {
    const apiKey = this.configService.get('DEEPSEEK_API_KEY');
    
    // Fallback si pas de clé API configurée
    if (!apiKey) {
      return this.getFallbackResponse(messages);
    }

    try {
      const response = await axios.post(
        this.DEEPSEEK_URL,
        {
          model: 'deepseek-chat',
          messages,
          temperature: 0.7,
          max_tokens: 2000
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      return response.data.choices[0]?.message?.content || this.getFallbackResponse(messages);
    } catch (error) {
      this.logger.warn('DeepSeek API Error - Using fallback', error.response?.data || error.message);
      return this.getFallbackResponse(messages);
    }
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
}