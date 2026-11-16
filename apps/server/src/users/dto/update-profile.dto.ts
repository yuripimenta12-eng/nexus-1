import { Matches, IsOptional, IsString, MaxLength } from 'class-validator';

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
  // Só cores hex: texto livre virava CSS (url(...)) e fazia quem visse o perfil baixar de outro site
  @Matches(/^#[0-9a-fA-F]{6}(,#[0-9a-fA-F]{6})?$/, { message: 'Cor do banner inválida' })
  bannerColor?: string; // ex.: "#ff6a00,#7c5af0" — usado quando não há bannerUrl
}
