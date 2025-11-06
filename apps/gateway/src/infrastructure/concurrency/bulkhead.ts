import { Injectable, HttpException, ServiceUnavailableException } from '@nestjs/common';
import { EnvService } from '../../config/env/env.service';
import { httpFetch, HttpClientOptions } from './http-client';
import { Bulkhead } from '../concurrency/bulkhead';

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
  for (const [k, v] of (h as any).entries()) out[k.toLowerCase()] = String(v);
  return out;
}

@Injectable()
export class AuthProxyService {
  private base = this.normalizeBase(EnvService.getStatic().gateway.authServiceUrl);

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

  // ===== Bulkhead (tunables por env) =====
  private readonly bulkhead = new Bulkhead(
    Number(process.env.GW_UP_MAX_CONCURRENCY ?? 8),
    Number(process.env.GW_UP_QUEUE_LIMIT ?? 64),
    Number(process.env.GW_UP_QUEUE_TIMEOUT_MS ?? 1000),
  );

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
    if (this.firstFailureAt === 0 || now - this.firstFailureAt > this.CB_ROLLING_WINDOW_MS) {
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

  private isRetryable(err: any): boolean {
    const s = String(err ?? '');
    if (err?.name === 'AbortError') return true;                     // timeout del cliente
    if (/Upstream 5\d\d/.test(s)) return true;                       // 5xx upstream
    if (s.includes('fetch failed') || s.includes('ECONN') || s.includes('ENOTFOUND')) return true; // red
    return false;
  }

  private buildHeaders(h?: Record<string, string | undefined>) {
    const out: Record<string, string> = {};
    if (h) {
      for (const [k, v] of Object.entries(h)) {
        if (v == null) continue;
        out[k.toLowerCase()] = String(v);
      }
    }
    if (!out['content-type']) out['content-type'] = 'application/json';
    return out;
  }

  private async coreRequest<T>(
    url: string,
    init: HttpClientOptions & { timeoutMs?: number },
    allowRetry: boolean,
    retries: number,
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
          if (status >= 500) this.onFailure();
          else this.onSuccess();

          if (allowRetry && status >= 500 && status < 600 && attempt < retries) {
            lastErr = new Error(`Upstream ${status}`);
            await sleep(this.computeBackoff(attempt));
            continue;
          }

          let payload: any = text;
          try { payload = JSON.parse(text); } catch {}
          throw new HttpException(
            payload && typeof payload === 'object' ? payload : { message: text || 'Upstream error' },
            status,
          );
        }

        this.onSuccess();

        let payload: any = null;
        try { payload = text ? JSON.parse(text) : null; } catch { /* noop */ }

        return { data: payload as T, headers: hdrs, status };
      } catch (err: any) {
        clearTimeout(id);
        lastErr = err;

        this.onFailure();

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
    init: HttpClientOptions & { timeoutMs?: number; retries?: number } = {},
  ): Promise<ProxyResult<T>> {
    const url = `${this.base}${path.startsWith('/') ? path : `/${path}`}`;
    const method = (init.method || 'GET').toUpperCase();

    // ===== Circuit Breaker quick-reject =====
    const now = Date.now();
    if (this.state === 'OPEN') {
      if (now < this.openUntil) {
        throw new ServiceUnavailableException('auth upstream temporarily unavailable (circuit open)');
      }
      this.state = 'HALF_OPEN';
      this.halfOpenProbeInFlight = false;
    }

    const allowRetry = this.isIdempotent(method);
    const retries = allowRetry ? (init.retries ?? this.MAX_RETRIES) : 0;

    if (this.state === 'HALF_OPEN') {
      if (this.halfOpenProbeInFlight) {
        throw new ServiceUnavailableException('auth upstream half-open (probe in progress)');
      }
      this.halfOpenProbeInFlight = true;
    }

    try {
      const headers = this.buildHeaders(init.headers);
      const initWithHeaders: HttpClientOptions & { timeoutMs?: number } = {
        ...init,
        headers,
      };

      // ===== Bulkhead: limita concurrencia y cola con timeout =====
      return await this.bulkhead.exec(() =>
        this.coreRequest<T>(url, initWithHeaders, allowRetry, retries),
      );
    } finally {
      if (this.state === 'HALF_OPEN') {
        this.halfOpenProbeInFlight = false;
      }
    }
  }

  // ===== Endpoints proxy =====

  health() {
    return this.request<{ ok: boolean; service?: string; dependencies?: any }>('/auth/health', {
      method: 'GET',
      timeoutMs: 2000,
      retries: 1,
    });
  }

  register(payload: unknown, extraHeaders?: Record<string, string>) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
      timeoutMs: 5000,
      retries: 0,
      headers: extraHeaders,
    });
  }

  login(payload: unknown, extraHeaders?: Record<string, string>) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
      timeoutMs: 5000,
      retries: 0,
      headers: extraHeaders,
    });
  }

  refresh(payload: unknown, extraHeaders?: Record<string, string>) {
    return this.request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: extraHeaders,
    });
  }

  logout(payload: unknown) {
    return this.request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  logoutAll(authHeader?: string) {
    return this.request('/auth/logout-all', {
      method: 'POST',
      headers: authHeader ? { authorization: authHeader } : {},
    });
  }

  me(authHeader?: string) {
    return this.request('/auth/me', {
      method: 'GET',
      headers: authHeader ? { authorization: authHeader } : {},
      timeoutMs: 3000,
      retries: 2,
    });
  }
}
