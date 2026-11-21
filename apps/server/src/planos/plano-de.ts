import { PrismaService } from '../prisma/prisma.service';
import { planoAtivo, type Plano } from './planos.regras';

/** Plano que vale agora para essa pessoa (lê do banco). */
export async function planoDe(prisma: PrismaService, userId: string): Promise<Plano> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { plano: true, planoAte: true } });
  return planoAtivo(u?.plano, u?.planoAte);
}
