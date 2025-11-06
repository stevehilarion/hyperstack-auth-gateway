import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError, finalize } from 'rxjs/operators';
import { withCtx } from './request-context';
import { LoggerService } from './logger.service';
import crypto from 'node:crypto';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    const requestId =
      req.headers['x-request-id']?.toString() ?? crypto.randomUUID();

    res.setHeader('x-request-id', requestId);

    const method = (req.method || 'GET').toUpperCase();
    const path = req.originalUrl || req.url || '/';
    const start = Date.now();

    const ctx = { requestId, method, path, startTime: start, userId: null };

    return withCtx(ctx, () => {
      this.logger.info('HTTP request start', { m: method, p: path });

      return next.handle().pipe(
        tap(() =>
          withCtx(ctx, () => {
            const dur = Date.now() - start;
            const status = res.statusCode ?? 200;
            this.logger.info('HTTP request end', { m: method, p: path, s: status, d: dur });
          }),
        ),
        catchError((err) => {
          withCtx(ctx, () => {
            const dur = Date.now() - start;
            const status = res.statusCode ?? 500;
            this.logger.error('HTTP request error', {
              m: method,
              p: path,
              s: status,
              d: dur,
              err: err?.message,
            });
          });
          throw err;
        }),
        finalize(() =>
          withCtx(ctx, () => {
            // hook futuras métricas/traces
          }),
        ),
      );
    });
  }
}
