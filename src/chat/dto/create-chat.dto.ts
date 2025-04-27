
import { IsUUID, IsNotEmpty } from 'class-validator';

export class CreateChatDto {
  @IsUUID(4)
  @IsNotEmpty()
  userId: string;
}