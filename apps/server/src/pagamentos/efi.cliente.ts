// Cliente mínimo da API Pix do Efí (mTLS com o certificado da conta).
// Variáveis: EFI_AMBIENTE (producao | homologacao), EFI_CLIENT_ID, EFI_CLIENT_SECRET,
// EFI_CHAVE_PIX e EFI_CERT_PEM_B64 (o .p12 convertido para PEM, em base64).
// Sem elas o Pix fica desligado e a API responde "pagamento indisponível".
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';

type Resposta = { status: number; json: any };

@Injectable()
export class EfiCliente {
  private readonly logger = new Logger(EfiCliente.name);
  readonly ambiente: 'producao' | 'homologacao';
  readonly ligado: boolean;
  private host: string;
  private agent?: https.Agent;
  private token?: { valor: string; expira: number };

  constructor(private config: ConfigService) {
    this.ambiente = config.get('EFI_AMBIENTE') === 'producao' ? 'producao' : 'homologacao';
    this.host = this.ambiente === 'producao' ? 'pix.api.efipay.com.br' : 'pix-h.api.efipay.com.br';
    const pem = config.get<string>('EFI_CERT_PEM_B64');
    this.ligado = !!(pem && config.get('EFI_CLIENT_ID') && config.get('EFI_CLIENT_SECRET') && config.get('EFI_CHAVE_PIX'));
    if (this.ligado) {
      const cert = Buffer.from(pem!, 'base64');
      this.agent = new https.Agent({ cert, key: cert, keepAlive: true });
      this.logger.log(`Pix do Efí ligado (${this.ambiente})`);
    }
  }

  private pedir(method: string, path: string, body?: unknown, auth?: string): Promise<Resposta> {
    return new Promise((ok, erro) => {
      const dados = body ? JSON.stringify(body) : undefined;
      const r = https.request({
        host: this.host, path, method, agent: this.agent, timeout: 15000,
        headers: {
          'Content-Type': 'application/json', Authorization: auth!,
          ...(dados ? { 'Content-Length': Buffer.byteLength(dados) } : {}),
        },
      }, res => {
        let t = '';
        res.on('data', c => (t += c));
        res.on('end', () => { let json: any = null; try { json = JSON.parse(t); } catch { /* corpo vazio */ } ok({ status: res.statusCode ?? 0, json }); });
      });
      r.on('timeout', () => r.destroy(new Error('Efí demorou para responder')));
      r.on('error', erro);
      if (dados) r.write(dados);
      r.end();
    });
  }

  private async autorizacao(): Promise<string> {
    if (this.token && this.token.expira > Date.now()) return `Bearer ${this.token.valor}`;
    const basic = Buffer.from(`${this.config.get('EFI_CLIENT_ID')}:${this.config.get('EFI_CLIENT_SECRET')}`).toString('base64');
    const r = await this.pedir('POST', '/oauth/token', { grant_type: 'client_credentials' }, `Basic ${basic}`);
    if (r.status !== 200 || !r.json?.access_token) throw new Error(`Efí recusou o login (HTTP ${r.status})`);
    // Renova 5 minutos antes de vencer
    this.token = { valor: r.json.access_token, expira: Date.now() + (Number(r.json.expires_in ?? 3600) - 300) * 1000 };
    return `Bearer ${this.token.valor}`;
  }

  private async api(method: string, path: string, body?: unknown): Promise<Resposta> {
    let r = await this.pedir(method, path, body, await this.autorizacao());
    if (r.status === 401) { this.token = undefined; r = await this.pedir(method, path, body, await this.autorizacao()); }
    return r;
  }

  /** Cria a cobrança e devolve o copia e cola e a imagem do QR Code (data URL). */
  async criarCobranca(txid: string, valor: string, descricao: string, validadeS: number) {
    const r = await this.api('PUT', `/v2/cob/${txid}`, {
      calendario: { expiracao: validadeS },
      valor: { original: valor },
      chave: this.config.get('EFI_CHAVE_PIX'),
      solicitacaoPagador: descricao.slice(0, 140),
    });
    if (r.status !== 201 || !r.json?.pixCopiaECola) {
      throw new Error(`Efí recusou a cobrança (HTTP ${r.status}): ${r.json?.mensagem ?? r.json?.nome ?? ''}`);
    }
    let imagem: string | null = null;
    if (r.json.loc?.id) {
      const q = await this.api('GET', `/v2/loc/${r.json.loc.id}/qrcode`);
      if (q.status === 200 && typeof q.json?.imagemQrcode === 'string') imagem = q.json.imagemQrcode;
    }
    return { copiaECola: r.json.pixCopiaECola as string, imagem };
  }

  /** Situação da cobrança: CONCLUIDA quando o Pix caiu. */
  async consultar(txid: string): Promise<{ status: string; e2eId?: string; valor?: string }> {
    const r = await this.api('GET', `/v2/cob/${txid}`);
    if (r.status !== 200) throw new Error(`Efí não achou a cobrança (HTTP ${r.status})`);
    const pix = Array.isArray(r.json?.pix) ? r.json.pix[0] : undefined;
    return { status: r.json?.status, e2eId: pix?.endToEndId, valor: pix?.valor };
  }
}
