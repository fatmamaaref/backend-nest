

import { Controller, Post, Body, UsePipes, ValidationPipe } from '@nestjs/common';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatService } from './chat.service'; 

@Controller('chat')

export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('start')
  async startChat(@Body() createChatDto: CreateChatDto) {
    return this.chatService.startChat(createChatDto);
  }

  @Post('message')
  @UsePipes(new ValidationPipe({ transform: true }))
  async sendMessage(@Body() sendMessageDto: SendMessageDto) {
    return this.chatService.sendMessage(sendMessageDto);
  }
 
}