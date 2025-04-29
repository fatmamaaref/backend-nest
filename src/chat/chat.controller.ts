

import { Controller, Post, Body, UsePipes, ValidationPipe, BadRequestException } from '@nestjs/common';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatService } from './chat.service'; 
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('chat')

export class ChatController {
  constructor(private readonly chatService: ChatService,
     private prisma: PrismaService
  ) {}

  @Post('start')
  async startChat(@Body() createChatDto: CreateChatDto) {
    return this.chatService.startChat(createChatDto);
  }

  
private async handleCommand(dto: SendMessageDto) {
  const command = dto.content.split(' ')[0];
  
  switch(command) {
    case '/mes-business':
      return this.listUserBusinesses(dto.userId);
    case '/ajouter-avis':
      return this.promptAddReview(dto);
    default:
      throw new BadRequestException(`Commande inconnue: ${command}`);
  }
}

private async listUserBusinesses(userId: string) {
  const businesses = await this.chatService.getUserBusinesses(userId);
  return {
    success: true,
    response: `Vos établissements:\n${businesses.map(b => `- ${b.name}`).join('\n')}`,
    chatId: 'command-response'
  };
}

private async promptAddReview(dto: SendMessageDto) {
  return {
    success: true,
    response: "Pour ajouter un avis, utilisez le format:\n/ajouter-avis [Nom du Business] \"Votre avis\" Note/5",
    chatId: dto.chatId
  };
}




@Post('message')
async sendMessage(@Body() dto: SendMessageDto) {
    // Ajoutez cette vérification pour les commandes
    if (dto.content.startsWith('/')) {
        return this.handleCommand(dto);
    }
    return this.chatService.sendMessage(dto);
}

}