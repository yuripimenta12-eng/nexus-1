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

  // Confia no primeiro proxy (Railway/Vercel edge). Sem isto, o Express lê o
  // IP do proxy interno em vez do IP real do cliente — o rate limit e os
  // logs por IP não funcionam. '1' confia só no 1º hop (não em X-Forwarded-For
  // arbitrário do cliente), evitando spoofing.
  app.set('trust proxy', 1);

  const configService = app.get(ConfigService);
  const appUrl = configService.get<string>('APP_URL', 'http://localhost:3000');

  // Segurança
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(cookieParser());

  // CORS — origens permitidas via variável de ambiente CORS_ORIGIN (csv) ou APP_URL
  const rawOrigins = configService.get<string>('CORS_ORIGIN', appUrl);
  const allowedOrigins = Array.from(
    new Set([...rawOrigins.split(',').map(o => o.trim()), 'http://localhost:3000']),
  ).filter(Boolean);

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
  if (configService.get<string>('NODE_ENV') !== 'production') {
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
  await app.listen(port);
  console.log(`🚀 Nexus Server rodando em http://localhost:${port}/api`);
  console.log(`📚 Docs: http://localhost:${port}/api/docs`);
}

bootstrap();
