import { Equals, IsEmail, IsString, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  displayName: string;

  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-z0-9_]+$/, {
    message: 'username: apenas letras minúsculas, números e underscore',
  })
  username: string;

  @IsEmail({}, { message: 'E-mail inválido' })
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: 'Senha fraca: use maiúscula, minúscula e número',
  })
  password: string;

  // Código de convite (secreto do admin OU código de convite de servidor).
  // Obrigatório quando REGISTRATION_CODE estiver definido no ambiente.
  @IsOptional()
  @IsString()
  @MaxLength(64)
  inviteCode?: string;

  // Declaração de ter 18 anos ou mais + aceite dos Termos e da Política (o Nexus é 18+).
  // Opcional de propósito: sem ela a conta nasce sem aceite e a janela do app pede antes de usar
  // (assim o site e o servidor podem ser atualizados em qualquer ordem).
  @IsOptional()
  @Equals(true, { message: 'O Nexus é só para maiores de 18 anos: confirme que você tem 18 anos ou mais e aceita os Termos' })
  maior18: boolean;

  // Código do link de indicação (nexuslink.art/r/<codigo>)
  @IsOptional()
  @IsString()
  @MaxLength(12)
  ref?: string;
}
