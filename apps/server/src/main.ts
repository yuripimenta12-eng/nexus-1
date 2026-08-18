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

  // CORS — permite o frontend conectar
  app.enableCors({
    origin: [appUrl, 'http://localhost:3000'],
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

  // Swagger (documentação — desabilitar em produção se quiser)
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Nexus API')
    .setDescription('API da plataforma de comunicação Nexus')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('PORT', 4000);
  await app.listen(port);
  console.log(`🚀 Nexus Server rodando em http://localhost:${port}/api`);
  console.log(`📚 Docs: http://localhost:${port}/api/docs`);
}

bootstrap();
