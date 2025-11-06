import { Injectable, Logger } from '@nestjs/common';
import { EnvService } from '../../config/env/env.service';
import { httpFetch } from '../http/http-client';
import { importJWK, jwtVerify } from 'jose';
import type { JWTPayload, JWK } from 'jose';

type VerifyKey = Parameters<typeof jwtVerify>[1];
type Cached = { keys: JWK[]; expiresAt: number };

const now = () => Date.now();

@Injectable()
export class JwksCacheService {
  private readonly log = new Logger(JwksCacheService.name);
  private cache: Cached | null = null;
  private readonly ttlMs = 10 * 60 * 1000;

  private get jwksUrl(): string {
    const base = EnvService.getStatic().gateway.authServiceUrl.replace(/\/$/, '');
    return `${base}/auth/.well-known/jwks.json`;
  }

  private async fetchJwks(): Promise<JWK[]> {
    const res = await httpFetch(this.jwksUrl, { method: 'GET' });
    if (!res.ok) throw new Error(`JWKS upstream ${res.status}`);
    const json = (await res.json()) as { keys?: JWK[] };
    if (!json?.keys || !Array.isArray(json.keys)) throw new Error('Invalid JWKS shape');
    return json.keys;
  }

  private async ensureFresh(): Promise<void> {
    const fresh = this.cache && this.cache.expiresAt > now();
    if (fresh) return;

    try {
      const keys = await this.fetchJwks();
      this.cache = { keys, expiresAt: now() + this.ttlMs };
    } catch (e) {
      if (this.cache) {
        this.log.warn(`JWKS refresh failed, using stale cache: ${String(e)}`);
        this.cache.expiresAt = now() + 60_000;
      } else {
        throw e;
      }
    }
  }

  async getKeyByKid(kid: string): Promise<VerifyKey> {
    // 1er intento con cache actual
    await this.ensureFresh();
    const c1 = this.cache as Cached | null;
    const keys1: JWK[] = Array.isArray(c1?.keys) ? (c1!.keys as JWK[]) : [];
    const jwk1 = keys1.find((k) => (k as any).kid === kid);
    if (jwk1) {
      return importJWK(jwk1, 'RS256') as unknown as VerifyKey;
    }

    this.cache = null;
    await this.ensureFresh();

    const c2 = this.cache as Cached | null;
    const keys2: JWK[] = Array.isArray(c2?.keys) ? (c2!.keys as JWK[]) : [];
    const jwk2 = keys2.find((k) => (k as any).kid === kid);
    if (!jwk2) throw new Error(`JWKS kid not found: ${kid}`);

    return importJWK(jwk2, 'RS256') as unknown as VerifyKey;
  }

  async verifyJwtRS256(
    token: string,
    expectedAud: string,
    expectedIss: string
  ): Promise<JWTPayload> {
    const [h] = token.split('.');
    if (!h) throw new Error('Malformed JWT');
    const header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8')) as { kid?: string };
    const kid = header.kid;
    if (!kid) throw new Error('Missing kid');

    const key = await this.getKeyByKid(kid);
    const { payload } = await jwtVerify(token, key, {
      audience: expectedAud,
      issuer: expectedIss,
    });
    return payload;
  }
}
