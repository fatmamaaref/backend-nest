import { IsUUID, IsString, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export class SendMessageDto {
  @IsUUID()
  @IsNotEmpty()
  chatId: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  content: string;

  @IsUUID()
  @IsNotEmpty()
  userId: string;
}
