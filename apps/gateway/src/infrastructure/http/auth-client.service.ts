import { Injectable, HttpException } from '@nestjs/common';
import { EnvService } from '../../config/env/env.service';
import { httpFetch, HttpClientOptions } from './http-client';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

@Injectable()
export class AuthClientService {
  private base = this.normalizeBase(EnvService.getStatic().gateway.authServiceUrl);

  private normalizeBase(url: string): string {
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }

  private async request<T>(
    path: string,
    init: HttpClientOptions & { timeoutMs?: number; retries?: number } = {},
  ): Promise<T> {
    const url = `${this.base}${path.startsWith('/') ? path : `/${path}`}`;
    const method = (init.method || 'GET').toUpperCase();
    const timeoutMs = init.timeoutMs ?? 3000;
    const allowRetry = ['GET', 'HEAD', 'OPTIONS'].includes(method);
    const retries = allowRetry ? (init.retries ?? 2) : 0;

    let lastErr: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await httpFetch(url, { ...init, signal: controller.signal });
        clearTimeout(id);

        if (!res.ok) {
          if (allowRetry && res.status >= 500 && res.status < 600 && attempt < retries) {
            lastErr = new Error(`Upstream ${res.status}`);
            await sleep(150 * (attempt + 1));
            continue;
          }
          const text = await res.text().catch(() => '');
          let payload: any = text;
          try { payload = JSON.parse(text); } catch {}
          throw new HttpException(
            payload && typeof payload === 'object' ? payload : { message: text || 'Upstream error' },
            res.status,
          );
        }
        return (await res.json().catch(() => null)) as T;
      } catch (err: any) {
        clearTimeout(id);
        lastErr = err;
        const retriable =
          allowRetry && (err?.name === 'AbortError' || /Upstream 5\d\d/.test(String(err)));
        if (attempt < retries && retriable) {
          await sleep(150 * (attempt + 1));
          continue;
        }
        break;
      }
    }
    throw lastErr;
  }

  // ===== Sesiones =====
  async revokeBySid(sid: string, auth?: string) {
    const res = await httpFetch(`${this.base}/auth/sessions/revoke`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(auth ? { authorization: auth } : {}),
      },
      body: JSON.stringify({ sid }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw Object.assign(new Error('Upstream error'), { status: res.status, body: json });
    }
    return json;
  }

  // ⬇️ NUEVO: listar sesiones del usuario autenticado
  listSessions(auth?: string) {
    return this.request('/auth/sessions', {
      method: 'GET',
      headers: auth ? { authorization: auth } : {},
      timeoutMs: 3000,
      retries: 1,
    });
  }

  // ===== Auth =====
  health() { return this.request<{ ok: boolean }>('/auth/health', { method: 'GET', timeoutMs: 2000, retries: 1 }); }
  register(payload: unknown, extraHeaders?: Record<string,string>) { return this.request('/auth/register', { method: 'POST', body: JSON.stringify(payload), timeoutMs: 5000, retries: 0, headers: extraHeaders }); }
  login(payload: unknown, extraHeaders?: Record<string,string>) { return this.request('/auth/login', { method: 'POST', body: JSON.stringify(payload), timeoutMs: 5000, retries: 0, headers: extraHeaders }); }
  refresh(payload: unknown, extraHeaders?: Record<string,string>) { return this.request('/auth/refresh', { method: 'POST', body: JSON.stringify(payload), headers: extraHeaders }); }
  logout(payload: unknown) { return this.request('/auth/logout', { method: 'POST', body: JSON.stringify(payload) }); }
  logoutAll(authHeader?: string) { return this.request('/auth/logout-all', { method: 'POST', headers: authHeader ? { authorization: authHeader } : {} }); }
  me(authHeader?: string) { return this.request('/auth/me', { method: 'GET', headers: authHeader ? { authorization: authHeader } : {}, timeoutMs: 3000, retries: 2 }); }
}
