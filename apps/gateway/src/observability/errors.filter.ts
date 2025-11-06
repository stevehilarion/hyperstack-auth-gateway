import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { httpErrorsTotal } from './metrics';

@Catch()
export class ErrorsFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res: any = ctx.getResponse();

    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const t = (() => {
      const msg = (exception?.message || '').toString().toLowerCase();
      if (msg.includes('jwt')) return 'jwt';
      if (msg.includes('throttl')) return 'throttled';
      if (msg.includes('timeout')) return 'timeout';
      if (status >= 500) return 'upstream';
      return 'unknown';
    })();

    httpErrorsTotal.inc({ type: t });
    res.status?.(status);
    res.json?.({ statusCode: status, message: exception?.message ?? 'Error' });
  }
}
