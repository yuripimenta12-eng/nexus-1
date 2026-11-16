import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Só confia no X-Forwarded-For quando quem conecta é o proxy local (Caddy
  // no mesmo host). Com '1', um cliente que chegasse direto na porta podia
  // inventar o IP e escapar do limite de tentativas de login.

  const configService = app.get(ConfigService);
  const appUrl = configService.get<string>('APP_URL', 'http://localhost:3000');
  app.set('trust proxy', configService.get<string>('TRUST_PROXY') || 'loopback');

  // Segurança
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(cookieParser());

  // CORS — origens permitidas via variável de ambiente CORS_ORIGIN (csv) ou APP_URL
  // localhost só fora de produção: em produção qualquer página em
  // http://localhost:3000 do navegador da vítima podia ler os tokens do refresh
  const rawOrigins = configService.get<string>('CORS_ORIGIN', appUrl);
  const isProd = configService.get<string>('NODE_ENV') === 'production';
  const allowedOrigins = Array.from(
    new Set([...rawOrigins.split(',').map(o => o.trim()), ...(isProd ? [] : ['http://localhost:3000'])]),
  ).filter(Boolean);

  // Rotas que mexem no cookie de sessão só aceitam o próprio site: um site
  // malicioso não consegue logar a vítima na conta do atacante (CSRF de login)
  const rotasDeSessao = /^\/api\/auth\/(login|login\/2fa|register|refresh|logout)\/?$/;
  app.use((req: any, res: any, next: any) => {
    const origin = req.headers.origin;
    if (req.method === 'POST' && origin && rotasDeSessao.test(req.path) && !allowedOrigins.includes(origin)) {
      return res.status(403).json({ statusCode: 403, message: 'Origem não permitida' });
    }
    next();
  });

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Prefix global da API
  app.setGlobalPrefix('api');

  // Validação automática de DTOs
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,       // remove campos não declarados no DTO
    forbidNonWhitelisted: true,
    transform: true,       // converte tipos automaticamente
    transformOptions: { enableImplicitConversion: true },
  }));

  // Swagger — só fora de produção. Em produção, expor /api/docs revela
  // toda a superfície da API (rotas, DTOs) para qualquer visitante.
  if (configService.get<string>('NODE_ENV') === 'development') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Nexus API')
      .setDescription('API da plataforma de comunicação Nexus')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = configService.get<number>('PORT', 4000);
  await app.listen(port, configService.get<string>('HOST') || '0.0.0.0');
  console.log(`🚀 Nexus Server rodando em http://localhost:${port}/api`);
  console.log(`📚 Docs: http://localhost:${port}/api/docs`);
}

bootstrap();
