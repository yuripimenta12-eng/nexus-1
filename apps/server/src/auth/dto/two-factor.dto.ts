import { IsString, Length, MaxLength } from 'class-validator';

export class TwoFactorCodeDto {
  @IsString()
  @Length(6, 20) // 6 dígitos do app ou código de recuperação (XXXXX-XXXXX)
  code: string;
}

export class TwoFactorLoginDto extends TwoFactorCodeDto {
  @IsString()
  @MaxLength(1000)
  ticket: string;
}

export class TwoFactorDisableDto extends TwoFactorCodeDto {
  @IsString()
  @MaxLength(128)
  password: string;
}
