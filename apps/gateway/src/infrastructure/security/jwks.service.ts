import { Injectable, Logger } from '@nestjs/common';
import { EnvService } from '../../config/env/env.service';
import { httpFetch } from '../http/http-client';
import jwkToPem from 'jwk-to-pem';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getCtx } from '../logging/request-context';

type Jwk = {
  kid?: string;
  kty?: string;
  n?: string;
  e?: string;
  x5c?: string[];
};

type JwksResponse = { keys: Jwk[] };

function now() { return Date.now(); }

@Injectable()
export class JwksService {
  private readonly log = new Logger(JwksService.name);

  private byKid = new Map<string, string>();  // kid -> PEM
  private expiresAt = 0;
  private etag: string | null = null;

  private readonly STALE_ERROR_MS = 60_000;   // 60s

  constructor(private readonly env: EnvService) {}

  private get jwksUrl(): string {
    const base = this.env.gateway.authServiceUrl.replace(/\/$/, '');
    return `${base}/auth/.well-known/jwks.json`;
  }

  private pickTtlMs(maxAgeHeader?: number, defaultMin = 5 * 60_000, defaultMax = 15 * 60_000) {
    if (typeof maxAgeHeader === 'number' && maxAgeHeader > 0) {
      return maxAgeHeader * 1000;
    }
    const jitter = defaultMin + Math.random() * (defaultMax - defaultMin);
    return Math.floor(jitter);
  }

  private pemFromJwk(jwk: Jwk): string | null {
    if (jwk.x5c?.length) {
      const cert = jwk.x5c[0];
      const chunks = cert.match(/.{1,64}/g) ?? [cert];
      return `-----BEGIN CERTIFICATE-----\n${chunks.join('\n')}\n-----END CERTIFICATE-----\n`;
    }
    try {
      return jwkToPem(jwk as any);
    } catch {
      return null;
    }
  }

  private parseMaxAge(cacheControl: string | null): number | undefined {
    if (!cacheControl) return undefined;
    const m = /max-age=(\d+)/i.exec(cacheControl);
    return m ? parseInt(m[1], 10) : undefined;
  }

  private readLocalPem(): string | null {
    const isDev = (this.env.raw.NODE_ENV || '').toLowerCase() === 'development';
    if (!isDev) return null;
    const configured = (this.env as any).jwt?.publicKeyFile || process.env.JWT_PUBLIC_KEY_FILE;
    if (!configured) return null;
    try {
      const p = path.resolve(process.cwd(), configured);
      return fs.readFileSync(p, 'utf8');
    } catch {
      return null;
    }
  }

  private async refresh(force = false): Promise<void> {
    if (!force && now() < this.expiresAt && this.byKid.size > 0) return;

    const rid = getCtx()?.requestId;
    const headers: Record<string, string> = {};
    if (this.etag) headers['If-None-Match'] = this.etag;
    if (rid) headers['x-request-id'] = rid;

    const res = await httpFetch(this.jwksUrl, { method: 'GET', headers });

    if (res.status === 304 && this.byKid.size) {
      const maxAge = this.parseMaxAge(res.headers.get('cache-control'));
      this.expiresAt = now() + this.pickTtlMs(maxAge);
      return;
    }

    if (!res.ok) throw new Error(`JWKS upstream ${res.status}`);

    const body = (await res.json()) as JwksResponse;
    if (!body || !Array.isArray(body.keys)) throw new Error('Invalid JWKS');

    const map = new Map<string, string>();
    for (const k of body.keys) {
      if (!k.kid) continue;
      const pem = this.pemFromJwk(k);
      if (pem) map.set(k.kid, pem);
    }
    if (map.size === 0) throw new Error('No usable keys');

    this.byKid = map;
    this.etag = res.headers.get('etag');

    const maxAge = this.parseMaxAge(res.headers.get('cache-control'));
    this.expiresAt = now() + this.pickTtlMs(maxAge);
  }

  async getPemByKid(kid?: string): Promise<string | null> {
    if (now() < this.expiresAt && this.byKid.size > 0) {
      if (kid && this.byKid.has(kid)) return this.byKid.get(kid)!;
      if (!kid && this.byKid.size === 1) return [...this.byKid.values()][0];
    }

    try {
      await this.refresh(true);
      if (kid) {
        const pem = this.byKid.get(kid) ?? null;
        if (pem) return pem;
      } else if (this.byKid.size === 1) {
        return [...this.byKid.values()][0];
      }

      await this.refresh(true);
      if (kid) return this.byKid.get(kid) ?? null;
      if (this.byKid.size === 1) return [...this.byKid.values()][0];
      return null;
    } catch (err) {
      if (this.byKid.size) {
        this.expiresAt = now() + this.STALE_ERROR_MS;
        this.log.warn(`JWKS refresh failed, using stale cache: ${String(err)}`);
        if (kid && this.byKid.has(kid)) return this.byKid.get(kid)!;
        if (!kid && this.byKid.size === 1) return [...this.byKid.values()][0];
      }

      const localPem = this.readLocalPem();
      if (localPem) {
        this.log.warn('Using local public PEM as last-resort (development only).');
        return localPem;
      }

      this.log.error(`JWKS fetch failed and no cache available: ${String(err)}`);
      return null;
    }
  }
}
