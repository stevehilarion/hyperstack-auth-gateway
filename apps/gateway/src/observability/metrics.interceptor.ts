import {
  CallHandler, ExecutionContext, Injectable, NestInterceptor
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { httpRequestsTotal, httpRequestDurationSeconds, statusFamily } from './metrics';

function hrtimeSec(): bigint { return process.hrtime.bigint(); }

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const http = ctx.switchToHttp();
    const req: any = http.getRequest();
    const res: any = http.getResponse();

    const controllerPath: string = (req?.route?.path)            // express/nest when present
      ?? (req?.baseUrl ? `${req.baseUrl}(root)` : undefined)
      ?? 'unknown';

    const method = (req?.method || 'GET').toUpperCase();
    const start = hrtimeSec();

    return next.handle().pipe(
      tap({
        next: () => {}, // no-op
        error: () => {
          const dur = Number(hrtimeSec() - start) / 1e9;
          const fam = statusFamily(res?.statusCode || 500);
          httpRequestsTotal.inc({ route: controllerPath, method, status_family: fam });
          httpRequestDurationSeconds.observe({ route: controllerPath, method, status_family: fam }, dur);
        },
        complete: () => {
          const dur = Number(hrtimeSec() - start) / 1e9;
          const fam = statusFamily(res?.statusCode || 200);
          httpRequestsTotal.inc({ route: controllerPath, method, status_family: fam });
          httpRequestDurationSeconds.observe({ route: controllerPath, method, status_family: fam }, dur);
        },
      }),
    );
  }
}

