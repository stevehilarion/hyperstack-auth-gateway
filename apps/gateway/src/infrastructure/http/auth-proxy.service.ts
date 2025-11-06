import {
  Injectable,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EnvService } from '../../config/env/env.service';
import { upstreamFetch as httpFetch } from '../../observability/upstream';
import { HttpClientOptions } from './http-client';

// ===== Helpers =====
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type ProxyResult<T> = {
  data: T;
  headers: Record<string, string>;
  status: number;
};

function headersToRecord(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  // @ts-ignore iterable en runtime
  for (const [k, v] of h.entries()) out[k.toLowerCase()] = String(v);
  return out;
}

// ===== Bulkhead (sin dependencias) =====
class InlineBulkhead {
  private running = 0;
  private readonly queue: {
    resolve: (v: any) => void;
    reject: (e: any) => void;
    fn: () => Promise<any>;
    timeoutAt: number;
  }[] = [];

  constructor(
    private readonly maxConcurrency = 50,
    private readonly queueLimit = 200,
    private readonly queueTimeoutMs = 2_000
  ) {}

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running < this.maxConcurrency) {
      this.running++;
      try {
        return await fn();
      } finally {
        this.running--;
        this.drain();
      }
    }

    if (this.queue.length >= this.queueLimit) {
      throw new ServiceUnavailableException('Bulkhead queue full');
    }

    return new Promise<T>((resolve, reject) => {
      const timeoutAt = Date.now() + this.queueTimeoutMs;
      this.queue.push({ resolve, reject, fn: () => fn(), timeoutAt });
    });
  }

  private drain() {
    const now = Date.now();
    while (this.queue.length && this.queue[0].timeoutAt <= now) {
      const t = this.queue.shift()!;
      t.reject(new ServiceUnavailableException('Bulkhead queue timeout'));
    }
    while (this.running < this.maxConcurrency && this.queue.length) {
      const t = this.queue.shift()!;
      this.running++;
      t.fn()
        .then((v) => t.resolve(v))
        .catch((e) => t.reject(e))
        .finally(() => {
          this.running--;
          this.drain();
        });
    }
  }
}

@Injectable()
export class AuthProxyService {
  private base = this.normalizeBase(
    EnvService.getStatic().gateway.authServiceUrl
  );

  private readonly bulkhead = new InlineBulkhead(64, 512, 2_000);

  // ====== Circuit Breaker state ======
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failures = 0;
  private firstFailureAt = 0;
  private openUntil = 0;
  private halfOpenProbeInFlight = false;

  // ====== Policies ======
  private readonly DEFAULT_TIMEOUT_MS = 3000;
  private readonly MAX_RETRIES = 2;
  private readonly BASE_BACKOFF_MS = 150;
  private readonly JITTER_MS = 100;

  private readonly CB_FAILURE_THRESHOLD = 5;
  private readonly CB_ROLLING_WINDOW_MS = 30_000;
  private readonly CB_OPEN_COOLDOWN_MS = 10_000;

  private normalizeBase(url: string): string {
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }

  private isIdempotent(method: string) {
    const m = method.toUpperCase();
    return m === 'GET' || m === 'HEAD' || m === 'OPTIONS';
  }

  private computeBackoff(attempt: number): number {
    const expo = Math.pow(2, attempt) * this.BASE_BACKOFF_MS;
    const jitter = Math.floor(Math.random() * this.JITTER_MS);
    return expo + jitter;
  }

  private onSuccess() {
    this.failures = 0;
    this.firstFailureAt = 0;
    if (this.state !== 'CLOSED') this.state = 'CLOSED';
  }

  private onFailure() {
    const now = Date.now();
    if (
      this.firstFailureAt === 0 ||
      now - this.firstFailureAt > this.CB_ROLLING_WINDOW_MS
    ) {
      this.firstFailureAt = now;
      this.failures = 1;
    } else {
      this.failures++;
    }

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.openUntil = now + this.CB_OPEN_COOLDOWN_MS;
      return;
    }

    if (this.failures >= this.CB_FAILURE_THRESHOLD) {
      this.state = 'OPEN';
      this.openUntil = now + this.CB_OPEN_COOLDOWN_MS;
    }
  }

  // === detección de errores de red / undici ===
  private isNetworkError(err: any): boolean {
    const code =
      err?.code ||
      err?.cause?.code ||
      (typeof err?.message === 'string' &&
      /ECONN(REFUSED|RESET)|ETIMEDOUT/i.test(err.message)
        ? 'NET'
        : undefined);

    if (code && /ECONNREFUSED|ECONNRESET|ETIMEDOUT/i.test(String(code)))
      return true;

    // undici suele arrojar TypeError('fetch failed') con cause.*
    if (
      err instanceof TypeError &&
      String(err.message || '').toLowerCase().includes('fetch failed')
    )
      return true;

    return false;
  }

  private isRetryable(err: any): boolean {
    const s = String(err ?? '');
    if (err?.name === 'AbortError') return true;
    if (this.isNetworkError(err)) return true;
    if (/Upstream 5\d\d/.test(s)) return true;
    return false;
  }

  private buildHeaders(
    h?: Record<string, string | undefined>,
    rid?: string
  ) {
    const out: Record<string, string> = {};
    if (h) {
      for (const [k, v] of Object.entries(h)) {
        if (v == null) continue;
        out[k.toLowerCase()] = String(v);
      }
    }
    if (!out['content-type']) out['content-type'] = 'application/json';
    if (rid && !out['x-request-id']) out['x-request-id'] = rid;
    return out;
  }

  private async coreRequest<T>(
    url: string,
    init: HttpClientOptions & { timeoutMs?: number },
    allowRetry: boolean,
    retries: number
  ): Promise<ProxyResult<T>> {
    let lastErr: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeoutMs = init.timeoutMs ?? this.DEFAULT_TIMEOUT_MS;
      const id = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await httpFetch(url, { ...init, signal: controller.signal });
        clearTimeout(id);

        const hdrs = headersToRecord(res.headers as any);
        const status = res.status;
        const text = await res.text().catch(() => '');

        if (!res.ok) {
          // 5xx -> falla para CB; 4xx no
          if (status >= 500) this.onFailure();
          else this.onSuccess();

          if (allowRetry && status >= 500 && status < 600 && attempt < retries) {
            lastErr = new Error(`Upstream ${status}`);
            await sleep(this.computeBackoff(attempt));
            continue;
          }

          let payload: any = text;
          try {
            payload = JSON.parse(text);
          } catch {}
          throw new HttpException(
            payload && typeof payload === 'object'
              ? payload
              : { message: text || 'Upstream error' },
            status
          );
        }

        this.onSuccess();

        let payload: any = null;
        try {
          payload = text ? JSON.parse(text) : null;
        } catch {
        }

        return { data: payload as T, headers: hdrs, status };
      } catch (err: any) {
        clearTimeout(id);
        lastErr = err;

        // cuenta falla para CB en errores de red o aborto
        if (err?.name === 'AbortError' || this.isNetworkError(err)) {
          this.onFailure();
        }

        if (attempt < retries && allowRetry && this.isRetryable(err)) {
          await sleep(this.computeBackoff(attempt));
          continue;
        }
        break;
      }
    }

    throw lastErr;
  }

  private async request<T>(
    path: string,
    init: HttpClientOptions & {
      timeoutMs?: number;
      retries?: number;
      rid?: string;
    } = {}
  ): Promise<ProxyResult<T>> {
    const url = `${this.base}${path.startsWith('/') ? path : `/${path}`}`;
    const method = (init.method || 'GET').toUpperCase();

    // ===== Circuit Breaker quick-reject =====
    const now = Date.now();
    if (this.state === 'OPEN') {
      if (now < this.openUntil) {
        throw new ServiceUnavailableException(
          'auth upstream temporarily unavailable (circuit open)'
        );
      }
      this.state = 'HALF_OPEN';
      this.halfOpenProbeInFlight = false;
    }

    const allowRetry = this.isIdempotent(method);
    const retries = allowRetry ? (init.retries ?? this.MAX_RETRIES) : 0;

    if (this.state === 'HALF_OPEN') {
      if (this.halfOpenProbeInFlight) {
        throw new ServiceUnavailableException(
          'auth upstream half-open (probe in progress)'
        );
      }
      this.halfOpenProbeInFlight = true;
    }

    try {
      const headers = this.buildHeaders(init.headers, init.rid);
      const initWithHeaders: HttpClientOptions & { timeoutMs?: number } = {
        ...init,
        headers,
      };

      // Bulkhead alrededor de la llamada real
      return await this.bulkhead.exec(() =>
        this.coreRequest<T>(url, initWithHeaders, allowRetry, retries)
      );
    } finally {
      if (this.state === 'HALF_OPEN') {
        this.halfOpenProbeInFlight = false;
      }
    }
  }

  // ===== Endpoints proxy =====

  health(rid?: string) {
    return this.request<{ ok: boolean }>('/auth/health', {
      method: 'GET',
      timeoutMs: 2000,
      retries: 1,
      rid,
    });
  }

  register(payload: unknown, extraHeaders?: Record<string, string>, rid?: string) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
      timeoutMs: 5000,
      retries: 0,
      headers: extraHeaders,
      rid,
    });
  }

  login(payload: unknown, extraHeaders?: Record<string, string>, rid?: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
      timeoutMs: 5000,
      retries: 0,
      headers: extraHeaders,
      rid,
    });
  }

  refresh(payload: unknown, extraHeaders?: Record<string, string>, rid?: string) {
    return this.request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: extraHeaders,
      rid,
    });
  }

  logout(payload: unknown, rid?: string) {
    return this.request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify(payload),
      rid,
    });
  }

  logoutAll(authHeader?: string, rid?: string) {
    return this.request('/auth/logout-all', {
      method: 'POST',
      headers: authHeader ? { authorization: authHeader } : {},
      rid,
    });
  }

  me(authHeader?: string, rid?: string) {
    return this.request('/auth/me', {
      method: 'GET',
      headers: authHeader ? { authorization: authHeader } : {},
      timeoutMs: 3000,
      retries: 2,
      rid,
    });
  }

  listSessions(authHeader?: string, rid?: string) {
    return this.request('/auth/sessions', {
      method: 'GET',
      headers: authHeader ? { authorization: authHeader } : {},
      timeoutMs: 3000,
      retries: 2,
      rid,
    });
  }

  revokeSession(sid: string, authHeader?: string, rid?: string) {
    return this.request('/auth/sessions/revoke', {
      method: 'POST',
      body: JSON.stringify({ sid }),
      headers: {
        ...(authHeader ? { authorization: authHeader } : {}),
      },
      timeoutMs: 5000,
      retries: 0,
      rid,
    });
  }
}
