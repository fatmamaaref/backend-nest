import { ApiProperty } from '@nestjs/swagger';

export class RespondToReviewResponse {
  @ApiProperty({
    example: true,
    description: 'Indicates if the operation was successful'
  })
  success: boolean;

  @ApiProperty({
    example: 'Nous vous remercions pour votre commentaire !',
    description: 'The generated response content',
    required: false
  })
  response?: string;

  @ApiProperty({
    example: '2023-07-15T10:00:00Z',
    description: 'Timestamp of when the response was generated',
    required: false
  })
  timestamp?: Date;
}