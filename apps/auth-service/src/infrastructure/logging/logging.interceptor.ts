import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError, finalize } from 'rxjs/operators';
import { setCtx, getCtx, RequestContext } from './request-context';
import { LoggerService } from './logger.service';
import crypto from 'node:crypto';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    const requestId = String(req.headers['x-request-id'] ?? crypto.randomUUID());
    res.setHeader('x-request-id', requestId);

    const method = (req.method || 'GET').toUpperCase();
    const path = req.originalUrl || req.url || '/';
    const start = Date.now();

    const ctx: RequestContext = { requestId, method, path, startTime: start, userId: null };
    setCtx(ctx);

    this.logger.info('HTTP request start', { m: method, p: path });

    return next.handle().pipe(
      tap(() => {
        const c = getCtx();
        const dur = Date.now() - start;
        const status = res.statusCode ?? 200;
        this.logger.info('HTTP request end', { m: method, p: path, s: status, d: dur, rid: c?.requestId ?? null });
      }),
      catchError((err) => {
        const dur = Date.now() - start;
        const status = res.statusCode ?? 500;
        this.logger.error('HTTP request error', {
          m: method, p: path, s: status, d: dur, err: err?.message,
        });
        throw err;
      }),
      finalize(() => {
        // hook futuro: métricas/tracing/cleanup
      }),
    );
  }
}
