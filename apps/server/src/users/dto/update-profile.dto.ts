import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  customStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  bannerColor?: string; // ex.: "#ff6a00,#7c5af0" — usado quando não há bannerUrl
}
