import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';

// Recusas do serviço (403 "Seu cargo não pode...", 400 "Mensagem muito longa")
// chegam ao navegador com o motivo, em vez de "Internal server error".
// Erros inesperados continuam genéricos (não vaza detalhe interno).
@Catch()
export class WsHttpExceptionFilter extends BaseWsExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    if (exception instanceof HttpException) {
      const res = exception.getResponse() as any;
      const raw = typeof res === 'string' ? res : res?.message;
      const message = Array.isArray(raw) ? raw[0] : raw || exception.message;
      return super.catch(new WsException(String(message).slice(0, 300)), host);
    }
    return super.catch(exception, host);
  }
}
