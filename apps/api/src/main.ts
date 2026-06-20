import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { GlobalExceptionFilter } from './common/global-exception.filter';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const expressJson = require('express').json as (input: { limit: string }) => unknown;
  const app = await NestFactory.create(AppModule);
  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: false,
  });
  app.setGlobalPrefix('api');
  app.use(expressJson({ limit: process.env.JSON_BODY_LIMIT ?? '32kb' }));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`TrustRoom API listening on http://localhost:${port}/api`);
}

void bootstrap();
