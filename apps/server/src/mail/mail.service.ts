import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

// Envio de e-mail transacional (hoje: redefinição de senha).
//
// Dois transportes, escolhidos pelas variáveis de ambiente:
//  1) BREVO_API_KEY  -> API HTTPS do Brevo (api.brevo.com/v3/smtp/email).
//     Preferido em produção: o Railway (plano Hobby) bloqueia as portas SMTP
//     25/465/587 na saída, mas HTTPS passa normalmente.
//  2) SMTP_HOST/SMTP_USER/SMTP_PASS -> SMTP clássico via nodemailer (útil em
//     desenvolvimento local ou num host que permita SMTP).
// Sem nenhum dos dois, o link é apenas logado no servidor.
//
// Toda tentativa tem tempo limite: um provedor pendurado nunca pode travar a
// requisição HTTP de "esqueci a senha".
const TIMEOUT_MS = 15_000;

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private brevoKey = '';
  private from: { name: string; email: string };

  constructor(private config: ConfigService) {
    this.from = parseFrom(config.get<string>('MAIL_FROM', 'Nexus <no-reply@nexus.local>'));
    this.brevoKey = (config.get<string>('BREVO_API_KEY', '') || '').trim();

    const host = config.get<string>('SMTP_HOST', '');
    const port = parseInt(config.get<string>('SMTP_PORT', '587'), 10);
    const user = config.get<string>('SMTP_USER', '');
    const pass = config.get<string>('SMTP_PASS', '');

    if (this.brevoKey) {
      this.logger.log('E-mail via API HTTPS do Brevo');
    } else if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // 465 = TLS implícito; 587 = STARTTLS
        auth: { user, pass },
        connectionTimeout: TIMEOUT_MS,
        greetingTimeout: TIMEOUT_MS,
        socketTimeout: TIMEOUT_MS,
      });
      this.logger.log(`SMTP configurado (${host}:${port})`);
    } else {
      this.logger.warn('E-mail não configurado (BREVO_API_KEY ou SMTP_*) — links serão apenas logados');
    }
  }

  get configured(): boolean {
    return !!this.brevoKey || !!this.transporter;
  }

  async sendPasswordReset(email: string, resetLink: string) {
    const subject = 'Nexus — redefinição de senha';
    const text = `Você pediu para redefinir sua senha no Nexus.\n\nAbra este link (válido por 1 hora):\n${resetLink}\n\nSe não foi você, ignore este e-mail.`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#120d1c;border-radius:16px;color:#e8e0f0">
        <h2 style="margin:0 0 4px;color:#fff">Nexus <span style="color:#ff6a00">Link</span></h2>
        <p style="color:#b3a8bf">Você pediu para redefinir sua senha.</p>
        <p style="margin:24px 0">
          <a href="${resetLink}"
             style="display:inline-block;padding:13px 26px;border-radius:12px;background:linear-gradient(110deg,#ff6a00,#7a2cff);color:#fff;text-decoration:none;font-weight:bold">
            Redefinir minha senha
          </a>
        </p>
        <p style="color:#8a8095;font-size:12px">O link vale por 1 hora. Se não foi você, ignore este e-mail.</p>
      </div>`;

    if (!this.configured) {
      this.logger.warn(`[sem e-mail] Link de reset para ${email}: ${resetLink}`);
      return;
    }
    try {
      if (this.brevoKey) await this.sendViaBrevo(email, subject, text, html);
      else await this.sendViaSmtp(email, subject, text, html);
      this.logger.log(`E-mail de reset enviado para ${email}`);
    } catch (err: any) {
      // Falha de envio não pode quebrar o fluxo (nem revelar nada ao cliente)
      this.logger.error(`Falha ao enviar e-mail para ${email}: ${err?.message}`);
    }
  }

  private async sendViaBrevo(to: string, subject: string, text: string, html: string) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': this.brevoKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: this.from,
          to: [{ email: to }],
          subject,
          textContent: text,
          htmlContent: html,
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Brevo HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  private async sendViaSmtp(to: string, subject: string, text: string, html: string) {
    await this.transporter!.sendMail({
      from: `${this.from.name} <${this.from.email}>`,
      to,
      subject,
      text,
      html,
    });
  }
}

// "Nexus <x@y.com>" -> { name: 'Nexus', email: 'x@y.com' }; "x@y.com" -> { name: 'Nexus', email }
function parseFrom(raw: string): { name: string; email: string } {
  const m = raw.match(/^\s*(?:"?([^"<]*)"?\s*)?<([^>]+)>\s*$/);
  if (m) return { name: (m[1] || 'Nexus').trim(), email: m[2].trim() };
  return { name: 'Nexus', email: raw.trim() };
}
