import { getCtx } from '../logging/request-context';
import crypto from 'node:crypto';

// ===== Tipos =====
export interface HttpClientOptions extends RequestInit {
  headers?: Record<string, string>;
  /** timeout total de la petición (ms). Si no se define: UPSTREAM_TIMEOUT_MS o 800ms */
  timeoutMs?: number;
}

// ===== Error tipificado para fallos de upstream (red/timeout) =====
export class UpstreamError extends Error {
  public readonly code?: string;
  public readonly retriable: boolean;
  public readonly upstreamOrigin: string;

  constructor(message: string, params: { cause?: any; code?: string; retriable: boolean; upstreamOrigin: string }) {
    super(message);
    this.name = 'UpstreamError';
    this.code = params.code;
    this.retriable = params.retriable;
    this.upstreamOrigin = params.upstreamOrigin;
    // @ts-ignore
    this.cause = params.cause;
  }
}

// ===== Utilidades =====
function pickTimeoutMs(explicit?: number): number {
  const env = Number(process.env.UPSTREAM_TIMEOUT_MS);
  if (Number.isFinite(env) && env > 0) return env;
  if (Number.isFinite(explicit) && (explicit as number) > 0) return explicit as number;
  return 800; // default conservador
}

function safeOrigin(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    return `${u.protocol}//${u.host}`;
  } catch {
    return 'unknown';
  }
}

// ===== Client =====
export async function httpFetch(url: string, options: HttpClientOptions = {}) {
  const ctx = getCtx();
  const rid = ctx?.requestId ?? crypto.randomUUID();

  const headers: Record<string, string> = {
    ...(options.headers || {}),
    'x-request-id': rid,
  };

  // setea content-type SOLO si hay body y no lo definieron
  if (options.body != null && !headers['content-type']) {
    headers['content-type'] = 'application/json';
  }

  const timeoutMs = pickTimeoutMs(options.timeoutMs);

  // AbortSignal.timeout en Node 18+. Fallback manual si no existiera.
  const signal = (AbortSignal as any).timeout
    ? (AbortSignal as any).timeout(timeoutMs)
    : (() => {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), timeoutMs).unref?.();
        return ctrl.signal;
      })();

  try {
    const response = await fetch(url, { ...options, headers, signal });
    return response;
  } catch (err: any) {
    // undici/Node lanza TypeError('fetch failed') con cause.code
    const code: string | undefined =
      err?.code ?? err?.cause?.code ?? (err?.name === 'AbortError' ? 'ETIMEDOUT' : undefined);

    const retriable =
      code === 'ECONNREFUSED' ||
      code === 'ETIMEDOUT' ||
      code === 'EAI_AGAIN' ||
      code === 'ECONNRESET' ||
      err?.name === 'AbortError';

    const upstreamOrigin = safeOrigin(url);

    // Lanzamos error tipificado para que el filtro lo convierta en 503.
    throw new UpstreamError('UPSTREAM_UNAVAILABLE', {
      cause: err,
      code,
      retriable,
      upstreamOrigin,
    });
  }
}
