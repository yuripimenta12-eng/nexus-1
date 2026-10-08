import { PrismaClient, MemberRole } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // Em produção nunca cria contas com as senhas de exemplo deste arquivo (o repositório é público)
  if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_PASSWORD) {
    throw new Error('Seed em produção exige ADMIN_PASSWORD (e não cria a conta demo).');
  }

  // Admin
  const adminPass = await argon2.hash(process.env.ADMIN_PASSWORD || 'Admin@123456');
  const admin = await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL || 'admin@nexus.local' },
    update: {},
    create: {
      email: process.env.ADMIN_EMAIL || 'admin@nexus.local',
      username: 'admin',
      passwordHash: adminPass,
      isVerified: true,
      isAdmin: true,
      profile: {
        create: {
          displayName: 'Admin',
          status: 'ONLINE',
        },
      },
    },
  });

  // Usuário demo
  const demoPass = await argon2.hash('Demo@123456');
  const demo = await prisma.user.upsert({
    where: { email: 'demo@nexus.local' },
    update: {},
    create: {
      email: 'demo@nexus.local',
      username: 'demo_user',
      passwordHash: demoPass,
      isVerified: true,
      profile: {
        create: {
          displayName: 'Usuário Demo',
          bio: 'Conta de demonstração do Nexus',
          status: 'ONLINE',
        },
      },
    },
  });

  // Servidor de demonstração
  const server = await prisma.server.upsert({
    where: { id: 'demo-server' },
    update: {},
    create: {
      id: 'demo-server',
      name: '🏠 Servidor Demo',
      description: 'Servidor de demonstração do Nexus. Explore todas as funcionalidades!',
      ownerId: admin.id,
      channels: {
        create: [
          { name: 'boas-vindas', type: 'ANNOUNCEMENT', position: 0 },
          { name: 'geral', type: 'TEXT', position: 1 },
          { name: 'off-topic', type: 'TEXT', position: 2 },
        ],
      },
      voiceRooms: {
        create: [
          { name: '🔊 Geral', position: 0, livekitRoom: 'demo-voice-general' },
          { name: '🎮 Jogos', position: 1, livekitRoom: 'demo-voice-games' },
        ],
      },
      members: {
        createMany: {
          data: [
            { userId: admin.id, role: MemberRole.OWNER },
            { userId: demo.id, role: MemberRole.MEMBER },
          ],
        },
      },
    },
    include: { channels: true },
  });

  // Mensagens de exemplo no canal geral
  const generalChannel = server.channels.find(c => c.name === 'geral');
  if (generalChannel) {
    const msgCount = await prisma.message.count({ where: { channelId: generalChannel.id } });

    if (msgCount === 0) {
      await prisma.message.createMany({
        data: [
          {
            channelId: generalChannel.id,
            authorId: admin.id,
            content: '👋 Bem-vindos ao **Nexus**! Esta é a nossa plataforma de comunicação.',
          },
          {
            channelId: generalChannel.id,
            authorId: demo.id,
            content: 'Olá! Que plataforma incrível! Testando o chat em tempo real... 🚀',
          },
          {
            channelId: generalChannel.id,
            authorId: admin.id,
            content: 'Experimente também as salas de voz com vídeo e compartilhamento de tela! 🎥',
          },
        ],
      });
    }
  }

  console.log('✅ Seed concluído!');
  console.log('📧 Contas de desenvolvimento criadas (admin e demo). Senhas: ver este arquivo.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
