import { IsString, Length } from 'class-validator';

export class VerifyEmailDto {
  @IsString()
  @Length(20, 120)
  token: string;
}
