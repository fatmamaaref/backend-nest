

import { Controller, Post, Body, UsePipes, ValidationPipe, BadRequestException, UseGuards } from '@nestjs/common';
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
  @UsePipes(new ValidationPipe({ transform: true }))
  async startChat(@Body() createChatDto: CreateChatDto) {
    try {
      return await this.chatService.startChat(createChatDto);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('message')
  @UsePipes(new ValidationPipe({ transform: true }))
  async sendMessage(@Body() dto: SendMessageDto) {
    try {
      // Vérification des commandes est maintenant gérée dans le service
      return await this.chatService.sendMessage(dto);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}


