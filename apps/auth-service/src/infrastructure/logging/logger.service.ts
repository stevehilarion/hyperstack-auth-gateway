import { Injectable } from '@nestjs/common';
import { getCtx } from './request-context';
import { AuthEnvService } from '../../config/env/env.service';

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

@Injectable()
export class LoggerService {
  private ts(): string | number {
    const env = AuthEnvService.getStatic()?.raw.NODE_ENV;
    return env === 'production' ? Date.now() : new Date().toISOString();
  }

  private out(level: LogLevel, msg: string, extra?: Record<string, unknown>) {
    const ctx = getCtx();
    const base = {
      t: this.ts(),
      lvl: level,
      rid: ctx?.requestId ?? null,
      ...extra,
      msg,
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(base));
  }

  info(msg: string, extra?: Record<string, unknown>) { this.out('INFO', msg, extra); }
  warn(msg: string, extra?: Record<string, unknown>) { this.out('WARN', msg, extra); }
  error(msg: string, extra?: Record<string, unknown>) { this.out('ERROR', msg, extra); }
}
