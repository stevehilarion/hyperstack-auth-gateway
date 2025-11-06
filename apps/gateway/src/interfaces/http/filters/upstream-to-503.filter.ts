import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { UpstreamError } from '../../../infrastructure/http/http-client';

@Catch()
export class UpstreamTo503Filter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    if (exception instanceof UpstreamError) {
      const retryAfter = exception.retriable ? '1' : '5';
      res
        .status(HttpStatus.SERVICE_UNAVAILABLE)
        .set({
          'Retry-After': retryAfter,
          'x-upstream-error': exception.code ?? 'UNKNOWN',
          'x-upstream-origin': exception.upstreamOrigin ?? 'unknown',
        })
        .json({
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          error: 'Service Unavailable',
          message: 'Upstream unavailable',
        });
      return;
    }

    if (looksLikeUndiciFetchFailed(exception)) {
      const code = (exception as any)?.cause?.code ?? 'UNKNOWN';
      res
        .status(HttpStatus.SERVICE_UNAVAILABLE)
        .set({
          'Retry-After': '1',
          'x-upstream-error': code,
          'x-upstream-origin': 'unknown',
        })
        .json({
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          error: 'Service Unavailable',
          message: 'Upstream unavailable',
        });
      return;
    }

    throw exception;
  }
}

function looksLikeUndiciFetchFailed(err: unknown): boolean {
  const e = err as any;
  return (
    e &&
    e instanceof Error &&
    e.message === 'fetch failed' &&
    (((e as any)?.cause?.code) || ((e as any)?.name === 'AbortError'))
  );
}
