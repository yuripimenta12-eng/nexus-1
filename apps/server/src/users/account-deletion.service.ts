import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';

// Chave do arquivo no storage a partir da URL pública (qualquer host antigo ou novo)
function keyFromUrl(url?: string | null): string | null {
  if (!url || url.startsWith('data:')) return null;
  const m = url.match(/\/((?:avatars|attachments|banners|server-icons|emojis)\/[^/?#]+)$/);
  return m ? m[1] : null;
}

// Exclusão da própria conta (LGPD — direito de eliminação dos dados).
// Os dados pessoais são APAGADOS; sobra só um registro anônimo ("Conta removida",
// sem e-mail/nome/login) porque registros de moderação e auditoria apontam
// para ele e precisam continuar íntegros.
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(private prisma: PrismaService, private upload: UploadService) {}

  async deleteMyAccount(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
    if (!user || user.isSuspended && user.email.endsWith('@removido.nexus.invalid')) {
      throw new NotFoundException('Conta não encontrada');
    }

    const ok = await argon2.verify(user.passwordHash, password).catch(() => false);
    if (!ok) throw new BadRequestException('Senha incorreta');

    // Dono de servidor: os outros membros perderiam o servidor junto
    const owned = await this.prisma.server.findMany({ where: { ownerId: userId }, select: { id: true, name: true } });
    if (owned.length) {
      throw new ConflictException({
        message: `Você é dono de ${owned.length === 1 ? 'um servidor' : `${owned.length} servidores`}. ` +
          'Transfira a posse para outra pessoa ou exclua o servidor antes de excluir sua conta.',
        servers: owned,
      });
    }

    // Arquivos no storage (apagados depois do banco, em segundo plano)
    const attachments = await this.prisma.attachment.findMany({ where: { uploaderId: userId }, select: { url: true } });
    const keys = [
      keyFromUrl(user.profile?.avatarUrl),
      keyFromUrl(user.profile?.bannerUrl),
      ...attachments.map(a => keyFromUrl(a.url)),
    ].filter((k): k is string => !!k);

    const tag = userId.slice(-8);
    await this.prisma.$transaction([
      this.prisma.session.deleteMany({ where: { userId } }),
      this.prisma.passwordReset.deleteMany({ where: { userId } }),
      this.prisma.pushSubscription.deleteMany({ where: { userId } }),
      this.prisma.directMessage.deleteMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } }),
      this.prisma.reaction.deleteMany({ where: { userId } }),
      this.prisma.attachment.deleteMany({ where: { uploaderId: userId } }),
      this.prisma.message.deleteMany({ where: { authorId: userId } }),
      this.prisma.invite.deleteMany({ where: { creatorId: userId } }),
      this.prisma.friendship.deleteMany({ where: { OR: [{ requesterId: userId }, { addresseeId: userId }] } }),
      this.prisma.block.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } }),
      this.prisma.serverMember.deleteMany({ where: { userId } }),
      this.prisma.callParticipant.deleteMany({ where: { userId } }),
      this.prisma.report.updateMany({ where: { targetUserId: userId }, data: { targetUserId: null } }),
      this.prisma.profile.update({
        where: { userId },
        data: {
          displayName: 'Conta removida', avatarUrl: null, bannerUrl: null, bannerColor: null,
          bio: null, customStatus: null, status: 'OFFLINE',
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          email: `removido+${userId}@removido.nexus.invalid`,
          username: `removido_${tag}`,
          // senha impossível de adivinhar: ninguém entra mais nesta conta
          passwordHash: await argon2.hash(randomBytes(32).toString('hex')),
          isSuspended: true,
          isVerified: false,
          isAdmin: false,
        },
      }),
    ]);

    for (const key of keys) {
      this.upload.deleteFile(key).catch(err => this.logger.warn(`Arquivo não apagado (${key}): ${err.message}`));
    }
    this.logger.log(`Conta ${userId} excluída a pedido do usuário (${keys.length} arquivo(s) removido(s))`);
    return { message: 'Conta excluída' };
  }
}
