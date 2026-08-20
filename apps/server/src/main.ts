import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const configService = app.get(ConfigService);
  const appUrl = configService.get<string>('APP_URL', 'http://localhost:3000');

  // Segurança
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(cookieParser());

  // CORS — permite o frontend conectar (produção + dev)
  const allowedOrigins = [
    appUrl,
    'http://localhost:3000',
    'http://localhost:3001',
  ].filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile, Postman, etc.)
      if (!origin) return callback(null, true);
      if (allowedOrigins.some(o => origin.startsWith(o))) {
        return callback(null, true);
      }
      // Allow any vercel.app subdomain
      if (origin.endsWith('.vercel.app')) return callback(null, true);
      callback(new Error('CORS not allowed: ' + origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Prefix global da API
  app.setGlobalPrefix('api');

  // Health check (Railway usa para verificar se o serviço está no ar)
  app.getHttpAdapter().get('/api/health', (_req: any, res: any) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Validação automática de DTOs
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  // Swagger (documentação)
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Nexus API')
    .setDescription('API da plataforma de comunicação Nexus')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('PORT', 4000);
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Nexus Server rodando em http://0.0.0.0:${port}/api`);
  console.log(`📚 Docs: http://0.0.0.0:${port}/api/docs`);
}

bootstrap();
