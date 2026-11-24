import {
  BadRequestException, HttpException, HttpStatus, Injectable, Logger, NotFoundException,
  OnModuleDestroy, OnModuleInit, ServiceUnavailableException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { PedidoPix } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlanosService } from '../planos/planos.service';
import { NexusGateway } from '../gateway/nexus.gateway';
import { EfiCliente } from './efi.cliente';
import { ErroPagamento, PIX_VALIDADE_S, centavosParaPix, produto, type Produto } from './pagamentos.regras';

const PEDIDOS_POR_10MIN = 6;
const VARRER_A_CADA_MS = 60_000;

// Pagamento por Pix. Confirmação: o site pergunta a cada poucos segundos enquanto o QR está
// aberto, e uma varredura a cada minuto confere os pendentes (pega quem fechou a página).
// shortcut: sem webhook do Efí (exige mTLS no Caddy); a confirmação pode levar até 1 minuto
// com a página fechada. Ligar o webhook se isso incomodar.
@Injectable()
export class PagamentosService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PagamentosService.name);
  private timer?: ReturnType<typeof setInterval>;
  private ultimaConsulta = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private planos: PlanosService,
    private gateway: NexusGateway,
    private efi: EfiCliente,
  ) {}

  onModuleInit() {
    if (!this.efi.ligado) return;
    this.timer = setInterval(() => this.varrer().catch(e => this.logger.warn(`Varredura: ${e.message}`)), VARRER_A_CADA_MS);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  disponivel() { return { ligado: this.efi.ligado, teste: this.efi.ambiente !== 'producao' }; }

  private publico(p: PedidoPix, prod?: Produto) {
    return {
      id: p.id, tipo: p.tipo, item: p.item, nome: prod?.nome ?? nomeDe(p), valorCentavos: p.valorCentavos,
      status: p.status, copiaECola: p.copiaECola, qrImagem: p.qrImagem, expiraEm: p.expiraEm, pagoEm: p.pagoEm,
    };
  }

  async criar(userId: string, body: { tipo?: unknown; item?: unknown; valorCentavos?: unknown }) {
    if (!this.efi.ligado) throw new ServiceUnavailableException('O pagamento por Pix está indisponível agora');
    let prod: Produto;
    try { prod = produto(body?.tipo, body?.item, body?.valorCentavos); } catch (e) {
      if (e instanceof ErroPagamento) throw new BadRequestException(e.message);
      throw e;
    }
    const agora = Date.now();

    // Mesmo produto com QR ainda valendo: mostra o mesmo (não cria cobrança à toa)
    const aberto = await this.prisma.pedidoPix.findFirst({
      where: {
        userId, ambiente: this.efi.ambiente, status: 'pendente', tipo: prod.tipo, item: prod.item,
        valorCentavos: prod.centavos, expiraEm: { gt: new Date(agora + 2 * 60_000) },
      },
      orderBy: { criadoEm: 'desc' },
    });
    if (aberto) return this.publico(aberto, prod);

    const recentes = await this.prisma.pedidoPix.count({ where: { userId, criadoEm: { gt: new Date(agora - 10 * 60_000) } } });
    if (recentes >= PEDIDOS_POR_10MIN) throw new HttpException('Muitos pedidos seguidos. Espere uns minutos.', HttpStatus.TOO_MANY_REQUESTS);

    const txid = 'nx' + randomBytes(15).toString('hex'); // 32 letras/números (o Pix aceita 26 a 35)
    let cob: { copiaECola: string; imagem: string | null };
    try {
      cob = await this.efi.criarCobranca(txid, centavosParaPix(prod.centavos), `Nexus: ${prod.nome}`, PIX_VALIDADE_S);
    } catch (e: any) {
      this.logger.error(`Cobrança não criada (${prod.item}): ${e.message}`);
      throw new HttpException('Não deu para gerar o Pix agora. Tente de novo em instantes.', HttpStatus.BAD_GATEWAY);
    }
    const p = await this.prisma.pedidoPix.create({
      data: {
        userId, txid, ambiente: this.efi.ambiente, tipo: prod.tipo, item: prod.item, valorCentavos: prod.centavos,
        copiaECola: cob.copiaECola, qrImagem: cob.imagem, expiraEm: new Date(agora + PIX_VALIDADE_S * 1000),
      },
    });
    return this.publico(p, prod);
  }

  async ver(userId: string, id: string) {
    let p = await this.prisma.pedidoPix.findFirst({ where: { id, userId } });
    if (!p) throw new NotFoundException('Pedido não encontrado');
    // Pergunta ao Efí no máximo a cada 3 s por pedido
    if (p.status === 'pendente' && p.ambiente === this.efi.ambiente && this.efi.ligado
      && Date.now() - (this.ultimaConsulta.get(p.id) ?? 0) > 3000) {
      this.ultimaConsulta.set(p.id, Date.now());
      if (this.ultimaConsulta.size > 5000) this.ultimaConsulta.clear();
      p = await this.verificar(p).catch(e => { this.logger.warn(`Consulta ${p!.txid}: ${e.message}`); return p!; });
    }
    return this.publico(p);
  }

  async varrer() {
    const pendentes = await this.prisma.pedidoPix.findMany({
      where: { status: 'pendente', ambiente: this.efi.ambiente, criadoEm: { gt: new Date(Date.now() - 3 * 3600_000) } },
      take: 50, orderBy: { criadoEm: 'asc' },
    });
    for (const p of pendentes) await this.verificar(p).catch(e => this.logger.warn(`Consulta ${p.txid}: ${e.message}`));
  }

  private async verificar(p: PedidoPix): Promise<PedidoPix> {
    const c = await this.efi.consultar(p.txid);
    if (c.status === 'CONCLUIDA') {
      const pago = c.valor ? Math.round(Number(c.valor) * 100) : p.valorCentavos;
      if (pago < p.valorCentavos) {
        this.logger.error(`Pedido ${p.id}: pago ${pago} centavos, esperado ${p.valorCentavos}. Não entregue.`);
        return p;
      }
      return this.confirmar(p, c.e2eId);
    }
    // Venceu (com folga para Pix atrasado) ou foi removida: encerra
    const removida = typeof c.status === 'string' && c.status.startsWith('REMOVIDA');
    if (removida || Date.now() > p.expiraEm.getTime() + 10 * 60_000) {
      await this.prisma.pedidoPix.updateMany({ where: { id: p.id, status: 'pendente' }, data: { status: 'expirado' } });
      return { ...p, status: 'expirado' };
    }
    return p;
  }

  private async confirmar(p: PedidoPix, e2eId?: string): Promise<PedidoPix> {
    // Só quem muda de pendente para pago entrega (a varredura e o site podem chegar juntos)
    const pagoEm = new Date();
    const r = await this.prisma.pedidoPix.updateMany({
      where: { id: p.id, status: 'pendente' }, data: { status: 'pago', pagoEm, e2eId: e2eId?.slice(0, 40) ?? null },
    });
    const atual = { ...p, status: 'pago', pagoEm, e2eId: e2eId ?? null };
    if (r.count !== 1) return (await this.prisma.pedidoPix.findUnique({ where: { id: p.id } })) ?? atual;
    try {
      await this.entregar(p);
      this.logger.log(`Pix pago: pedido ${p.id} (${p.item}, ${p.valorCentavos} centavos)`);
    } catch (e: any) {
      // Pago mas não entregue: não volta para pendente (evita entregar duas vezes); a equipe resolve
      this.logger.error(`PAGO E NÃO ENTREGUE: pedido ${p.id} (${p.item}): ${e.message}`);
    }
    this.gateway.emitToUser(p.userId, 'pagamento:pago', { id: p.id, tipo: p.tipo, item: p.item });
    return atual;
  }

  private async entregar(p: PedidoPix) {
    const prod = produto(p.tipo, p.item, p.valorCentavos);
    if (prod.tipo === 'plano') {
      await this.planos.definir(p.userId, prod.plano, prod.dias);
      this.gateway.emitToUser(p.userId, 'plano:atualizado', {});
    } else if (prod.tipo === 'prisma') {
      await this.prisma.$transaction(async (tx) => {
        await tx.carteira.upsert({ where: { userId: p.userId }, create: { userId: p.userId }, update: {} });
        await tx.carteira.update({ where: { userId: p.userId }, data: { prismas: { increment: prod.prismas } } });
        await tx.prismaMovimento.create({ data: { userId: p.userId, valor: prod.prismas, motivo: 'Compra por Pix' } });
      });
    }
    // doação: não entrega nada (se desse algo em troca, viraria venda)
  }
}

function nomeDe(p: PedidoPix) {
  try { return produto(p.tipo, p.item, p.valorCentavos).nome; } catch { return p.item; }
}
