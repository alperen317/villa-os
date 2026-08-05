import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { mkdirSync } from 'fs';
import { AppModule } from './app/app.module';
import { UPLOADS_ROOT } from './app/infra/uploads/uploads-path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  mkdirSync(UPLOADS_ROOT, { recursive: true });
  app.useStaticAssets(UPLOADS_ROOT, { prefix: '/uploads/' });

  app.enableCors({ origin: 'http://localhost:4200', exposedHeaders: ['X-Total-Count'] });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Villa Management System API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(`🚀 Application is running on: http://localhost:${port}/api/v1`);
  Logger.log(`📘 Swagger docs available at: http://localhost:${port}/api/docs`);
}

bootstrap();
