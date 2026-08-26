import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private from: string;

  constructor(private config: ConfigService) {
    const host = config.get<string>('SMTP_HOST', '');
    const port = parseInt(config.get<string>('SMTP_PORT', '587'), 10);
    const user = config.get<string>('SMTP_USER', '');
    const pass = config.get<string>('SMTP_PASS', '');
    this.from = config.get<string>('MAIL_FROM', 'Nexus <no-reply@nexus.local>');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // 465 = TLS implícito; 587 = STARTTLS
        auth: { user, pass },
      });
      this.logger.log(`SMTP configurado (${host}:${port})`);
    } else {
      this.logger.warn('SMTP não configurado — e-mails serão apenas logados');
    }
  }

  async sendPasswordReset(email: string, resetLink: string) {
    if (!this.transporter) {
      this.logger.warn(`[sem SMTP] Link de reset para ${email}: ${resetLink}`);
      return;
    }
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: email,
        subject: 'Nexus — redefinição de senha',
        text: `Você pediu para redefinir sua senha no Nexus.\n\nAbra este link (válido por 1 hora):\n${resetLink}\n\nSe não foi você, ignore este e-mail.`,
        html: `
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
          </div>`,
      });
      this.logger.log(`E-mail de reset enviado para ${email}`);
    } catch (err: any) {
      // Falha de envio não pode quebrar o fluxo (nem revelar nada ao cliente)
      this.logger.error(`Falha ao enviar e-mail para ${email}: ${err?.message}`);
    }
  }
}
