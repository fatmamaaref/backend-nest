// src/webhook/dto/facebook-webhook.dto.ts
import { IsString, IsArray, ValidateNested, IsNotEmpty, IsNumber } from 'class-validator';


class FromDto {
    @IsString()
    name: string;
  
    @IsString()
    id: string;
  }
  
  class ChangeValueDto {
    @IsString()
    item: string;
  
    @IsString()
    comment_id: string;
  
    @IsString()
    post_id: string;
  
    @ValidateNested()
    from: FromDto;
  
    @IsString()
    message: string;
  
    @IsNotEmpty()
    created_time: number;
  }
  
  class ChangeDto {
    @ValidateNested()
    value: ChangeValueDto;
  
    @IsString()
    field: string;
  }
  
  class EntryDto {
    @IsString()
    id: string;
  
    @IsArray()
    @ValidateNested({ each: true })
    changes: ChangeDto[];
  }
  
  export class FacebookWebhookDto {
    @IsString()
    object: string;
  
    @IsArray()
    @ValidateNested({ each: true })
    entry: EntryDto[];
  }