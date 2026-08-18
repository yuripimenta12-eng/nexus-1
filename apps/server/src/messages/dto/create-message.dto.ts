import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content: string;

  @IsOptional()
  @IsString()
  replyToId?: string;
}
