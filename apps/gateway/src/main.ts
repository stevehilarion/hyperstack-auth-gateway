import { NestFactory } from '@nestjs/core';
import { BootstrapModule } from './app/bootstrap/bootstrap.module';
import { EnvService } from './config/env/env.service';
import helmet from 'helmet';
import * as express from 'express';
import { ValidationPipe } from '@nestjs/common';
import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { registry } from './observability/metrics';
import { startOtel } from './observability/otel';

async function bootstrap() {
  await startOtel();

  const app = await NestFactory.create(BootstrapModule);

  (app.getHttpAdapter().getInstance() as any).set('trust proxy', true);

  const env = EnvService.getStatic().raw;

  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: true }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      validateCustomDecorators: true,
      forbidUnknownValues: false,
    }),
  );

  if (env.NODE_ENV === 'development') {
    app.enableCors();
  } else {
    app.enableCors({
      origin: env.ALLOWED_ORIGINS.length ? env.ALLOWED_ORIGINS : false,
      credentials: true,
    });
  }

  app.use((req: Request & { _rid?: string }, res: Response, next: NextFunction) => {
    if ((req as any).path === '/metrics') return next();
    const rid = String((req.headers['x-request-id'] as string | undefined) ?? crypto.randomUUID());
    (req as any)._rid = rid;
    res.setHeader('x-request-id', rid);
    next();
  });

  app.getHttpAdapter().get('/metrics', async (_req: any, res: any) => {
    res.setHeader('Content-Type', registry.contentType);
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.end(await registry.metrics());
  });

  {
    const http = app.getHttpAdapter().getInstance(); // instancia Express
    const AUTH_BASE = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

    http.use('/api/auth', async (req: any, res: any) => {
      try {
        const upstreamUrl = new URL(
          req.originalUrl.replace(/^\/api\/auth/, '/auth'),
          AUTH_BASE,
        );

        const hop = new Set([
          'connection',
          'keep-alive',
          'proxy-authenticate',
          'proxy-authorization',
          'te',
          'trailer',
          'transfer-encoding',
          'upgrade',
        ]);

        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(req.headers)) {
          if (!v) continue;
          if (hop.has(k.toLowerCase())) continue;
          headers[k] = Array.isArray(v) ? v.join(',') : String(v);
        }

        headers['x-forwarded-for'] = `${
          req.headers['x-forwarded-for'] ?? ''
        }${req.headers['x-forwarded-for'] ? ',' : ''}${
          req.socket?.remoteAddress ?? ''
        }`;

        let body: any = undefined;
        if (!['GET', 'HEAD'].includes(String(req.method).toUpperCase())) {
          body = req.body ? JSON.stringify(req.body) : undefined;
          if (body) headers['content-type'] = headers['content-type'] ?? 'application/json';
        }

        const upstream = await fetch(upstreamUrl.toString(), {
          method: req.method,
          headers,
          body,
        });

        res.status(upstream.status);
        upstream.headers.forEach((val, key) => {
          if (!hop.has(key.toLowerCase())) res.setHeader(key, val);
        });

        const buf = Buffer.from(await upstream.arrayBuffer());
        res.send(buf);
      } catch (e: any) {
        res
          .status(502)
          .json({ error: 'bad_gateway', detail: e?.message ?? 'proxy error' });
      }
    });
  }

  const server = app.getHttpServer();
  server.headersTimeout = 65_000;
  server.requestTimeout = 30_000;

  const port = EnvService.getStatic().gateway.port;
  await app.listen(port, '0.0.0.0');
  console.log(` Gateway running on http://localhost:${port}/health`);
}
bootstrap();
