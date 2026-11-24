import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PresenceService } from '../presence/presence.service';
import { BENEFICIOS, planoAtivo } from '../planos/planos.regras';
import { limparConexoes, limparCorNome, limparJogos } from './perfil-gamer';
import { toSafeUser } from '../common/safe-user';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserStatus } from '@prisma/client';
import { canAccessVoiceRoom, toPublicVoiceRoom, MEMBER_WITH_ROLES_INCLUDE } from '../voice/voice-access';
import { UploadService } from '../upload/upload.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService, private presence: PresenceService, private upload: UploadService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return toSafeUser(user);
  }

  // Perfil de OUTRA pessoa: só o que é público (sem e-mail, admin, suspensão etc.).
  // Com viewerId vem também o perfil gamer: números, em comum e o jogo aberto.
  async findPublicProfile(id: string, viewerId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        createdAt: true,
        isBetaTester: true,
        isStaff: true, // selo STAFF no perfil
        plano: true,
        profile: {
          select: {
            displayName: true, avatarUrl: true, bannerUrl: true, bannerColor: true,
            bio: true, status: true, customStatus: true, moldura: true, icone: true, placa: true, efeitoPerfil: true,
            corNome: true, jogos: true, conexoes: true, procurandoDuo: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    if (!viewerId) return user;

    const amigosDe = (uid: string) => this.prisma.friendship.findMany({
      where: { status: 'ACCEPTED', OR: [{ requesterId: uid }, { addresseeId: uid }] },
      select: { requesterId: true, addresseeId: true },
    }).then(fs => new Set(fs.map(f => (f.requesterId === uid ? f.addresseeId : f.requesterId))));
    const proprio = viewerId === id;

    const [call, carteira, servidores, amigosDele, amigosMeus, jogando] = await Promise.all([
      this.prisma.callStat.aggregate({ where: { userId: id }, _sum: { segundosCall: true } }),
      this.prisma.carteira.findUnique({ where: { userId: id }, select: { unidosVitorias: true } }),
      proprio ? Promise.resolve([]) : this.prisma.server.findMany({
        where: { AND: [
          { members: { some: { userId: id, banned: false } } },
          { members: { some: { userId: viewerId, banned: false } } },
        ] },
        select: { id: true, name: true, iconUrl: true },
        take: 20,
      }),
      proprio ? Promise.resolve(new Set<string>()) : amigosDe(id),
      proprio ? Promise.resolve(new Set<string>()) : amigosDe(viewerId),
      this.presence.getActivity(id),
    ]);
    return {
      ...user,
      numeros: {
        horasCall: Math.floor((call._sum.segundosCall ?? 0) / 3600),
        vitoriasUnidos: carteira?.unidosVitorias ?? 0,
      },
      emComum: proprio ? null : { servidores, amigos: [...amigosDele].filter(a => amigosMeus.has(a)).length },
      jogando,
    };
  }

  async findByUsername(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      include: { profile: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return toSafeUser(user);
  }

  async searchUsers(query: string, excludeUserId: string) {
    if (!query || query.trim().length < 2) return [];

    const users = await this.prisma.user.findMany({
      where: {
        id: { not: excludeUserId },
        OR: [
          { username: { contains: query.toLowerCase(), mode: 'insensitive' } },
          { profile: { displayName: { contains: query, mode: 'insensitive' } } },
        ],
      },
      take: 20,
      // Só o público: antes ia o e-mail de quem aparecesse na busca
      select: { id: true, username: true, profile: { select: { displayName: true, avatarUrl: true, status: true } } },
    });

    return users;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const gamer: Prisma.ProfileUpdateInput = {};
    try {
      if (dto.jogos !== undefined) gamer.jogos = (limparJogos(dto.jogos) as Prisma.InputJsonValue | null) ?? Prisma.DbNull;
      if (dto.conexoes !== undefined) gamer.conexoes = limparConexoes(dto.conexoes) ?? Prisma.DbNull;
      if (dto.corNome !== undefined) gamer.corNome = limparCorNome(dto.corNome);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
    if (dto.procurandoDuo !== undefined) gamer.procurandoDuo = dto.procurandoDuo;
    // Cor no nome é do Nexus+ e do Pro (tirar a cor vale para todos)
    if (gamer.corNome) {
      const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { plano: true, planoAte: true } });
      if (!BENEFICIOS[planoAtivo(u?.plano, u?.planoAte)].corNome) throw new ForbiddenException('A cor no nome vem com o Nexus+ ou o Pro');
    }
    const capaAntes = dto.bannerColor !== undefined
      ? (await this.prisma.profile.findUnique({ where: { userId }, select: { bannerUrl: true } }))?.bannerUrl
      : null;
    const profile = await this.prisma.profile.update({
      where: { userId },
      data: {
        ...gamer,
        displayName: dto.displayName,
        bio: dto.bio,
        customStatus: dto.customStatus,
        // Escolher uma cor de banner substitui a imagem enviada
        ...(dto.bannerColor !== undefined
          ? { bannerColor: dto.bannerColor, bannerUrl: null }
          : {}),
      },
    });
    this.upload.apagarFotoAntiga(capaAntes);
    // Nome novo aparece na página inicial: o depoimento volta para aprovação
    if (dto.displayName !== undefined) await this.revisarDepoimento(userId);
    return profile;
  }

  async revisarDepoimento(userId: string) {
    await this.prisma.depoimento.updateMany({ where: { userId, aprovado: true }, data: { aprovado: false } }).catch(() => {});
  }

  async removeBanner(userId: string) {
    const antes = await this.prisma.profile.findUnique({ where: { userId }, select: { bannerUrl: true } });
    const p = await this.prisma.profile.update({
      where: { userId },
      data: { bannerUrl: null, bannerColor: null },
    });
    this.upload.apagarFotoAntiga(antes?.bannerUrl);
    return p;
  }

  async removeAvatar(userId: string) {
    const antes = await this.prisma.profile.findUnique({ where: { userId }, select: { avatarUrl: true } });
    const p = await this.prisma.profile.update({
      where: { userId },
      data: { avatarUrl: null },
    });
    this.upload.apagarFotoAntiga(antes?.avatarUrl);
    return p;
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    return this.prisma.profile.update({
      where: { userId },
      data: { avatarUrl },
    });
  }

  async updateStatus(userId: string, status: UserStatus) {
    return this.prisma.profile.update({
      where: { userId },
      data: { status },
    });
  }

  async getServersForUser(userId: string) {
    const memberships = await this.prisma.serverMember.findMany({
      where: { userId, banned: false },
      include: {
        ...MEMBER_WITH_ROLES_INCLUDE,
        server: {
          include: {
            channels: { orderBy: { position: 'asc' }, take: 1 },
            voiceRooms: { orderBy: { position: 'asc' }, include: { allowedRoles: { select: { id: true } } } },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
    // Salas restritas por cargo só aparecem para quem pode entrar (mesma regra do findById)
    return memberships.map(({ roleAssignments, ...m }) => ({
      ...m,
      server: {
        ...m.server,
        voiceRooms: m.server.voiceRooms
          .filter(r => canAccessVoiceRoom(r, { ...m, roleAssignments }, m.server.ownerId))
          .map(toPublicVoiceRoom),
      },
    }));
  }
}
