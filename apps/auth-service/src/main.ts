import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AuthBootstrapModule } from './app/bootstrap/bootstrap.module';
import { loadAuthEnvOrDie } from './config/env/env.loader';
import { AuthEnvService } from './config/env/env.service';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as express from 'express';

import { startOtel } from './observability/otel';

async function bootstrap() {
  await startOtel();

  const env = loadAuthEnvOrDie();
  AuthEnvService.create(env);

  const app = await NestFactory.create(AuthBootstrapModule);

  (app as any).set?.('trust proxy', true);

  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: true }));

  if ((process.env.NODE_ENV || '').toLowerCase() === 'development') {
    app.enableCors();
  } else {
    app.enableCors({ origin: false });
  }

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    validateCustomDecorators: true,
    forbidUnknownValues: false,
  }));

  const server = app.getHttpServer();
  (server as any).headersTimeout = 65_000;
  (server as any).requestTimeout = 30_000;

  const port = AuthEnvService.getStatic().auth.port;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(` Auth-service running on http://localhost:${port}`);
}

bootstrap();
