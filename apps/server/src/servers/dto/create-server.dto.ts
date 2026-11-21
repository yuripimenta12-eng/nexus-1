import { IsString, MinLength, MaxLength, IsOptional, IsInt, Min, Max, IsIn } from 'class-validator';

export class CreateServerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(500)
  maxMembers?: number;

  // Modelo pronto: "gamer" já vem com salas de squad, campeonato e jogos
  @IsOptional()
  @IsIn(['padrao', 'gamer'])
  modelo?: 'padrao' | 'gamer';
}
