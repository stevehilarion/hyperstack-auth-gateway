import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import ms from 'ms';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { JwtRs256Service } from '../../infrastructure/security/jwt-rs256.service';
import { AuthEnvService } from '../../config/env/env.service';

type AccessClaims = { sub: string; email?: string | null; role?: string | null };
type RefreshClaims = { sub: string; jti: string; sid: string; exp: number };

type Meta = { ua?: string | null; ip?: string | null; deviceId?: string | null };

function computeThresholdSec(refreshTtl: string, raw?: string): number {
  const v = (raw ?? '').trim();
  if (!v) return 0; // 0 => rotar SIEMPRE
  if (v.endsWith('%')) {
    const pct = Math.max(0, Math.min(100, Number(v.slice(0, -1))));
    const ttlMs = ms(refreshTtl);
    return Math.ceil((ttlMs * (pct / 100)) / 1000);
  }
  return Math.ceil(ms(v) / 1000); // e.g. '2d', '6h'
}

@Injectable()
export class TokenService {
  constructor(
    private readonly redis: RedisService,
    private readonly jwt: JwtRs256Service,
    private readonly env: AuthEnvService,
  ) {}

  /** ===== Keys ===== */
  private kActive(sid: string) { return `rt:active:${sid}`; }
  private kPrev(sid: string)   { return `rt:prev:${sid}`; }  
  private kLast(sid: string)   { return `rt:last:${sid}`; }  
  private kUserSids(userId: string) { return `rt:sids:${userId}`; }
  private kRevoked(sid: string) { return `rt:revoked:${sid}`; }
  private kSess(sid: string)    { return `rt:sess:${sid}`; } 

  /** ===== Access ===== */
  createAccessToken(claims: AccessClaims) {
    return this.jwt.signAccess({ sub: claims.sub, email: claims.email ?? null });
  }

  /** ===== Initial Refresh (new device/session) ===== */
  async createInitialRefresh(userId: string, meta?: Meta) {
    const sid = randomUUID();
    const jti = randomUUID();

    const refresh = this.jwt.signRefresh({ sub: userId, jti, sid });
    const ttlSec = Math.ceil(ms(this.env.raw.jwt.refreshTtl) / 1000);

    const nowIso = new Date().toISOString();
    const m = {
      ua: meta?.ua ?? '',
      ip: meta?.ip ?? '',
      deviceId: meta?.deviceId ?? '',
      createdAt: nowIso,
      lastSeenAt: nowIso,
    };

    await this.redis.raw.multi()
      .set(this.kActive(sid), jti, 'EX', ttlSec)
      .hset(this.kSess(sid), m as any)
      .expire(this.kSess(sid), ttlSec)
      .sadd(this.kUserSids(userId), sid)
      .exec();

    return { refresh, sid, jti };
  }

  /** ===== Rotate Refresh (sliding + reuse detection + grace + idempotencia) ===== */
  async rotateRefresh(presentedRefresh: string, meta?: Meta) {
    let payload: RefreshClaims;
    try {
      const p = this.jwt.verifyRefresh(presentedRefresh);
      if (!p.exp) throw new UnauthorizedException('Missing exp');
      payload = { sub: p.sub, jti: p.jti, sid: p.sid, exp: p.exp };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const remain = Math.max(payload.exp - nowSec, 0);

    // Umbral configurable (0 => rotar SIEMPRE)
    const SLIDING_THRESHOLD_SEC = computeThresholdSec(
      this.env.raw.jwt.refreshTtl,
      process.env.JWT_REFRESH_SLIDING_THRESHOLD
    );
    const forceRotate = SLIDING_THRESHOLD_SEC <= 0;

    // Si la familia ya está revocada, ni lo intentes
    const revoked = await this.redis.raw.get(this.kRevoked(payload.sid));
    if (revoked) throw new UnauthorizedException('Session revoked');

    const activeKey = this.kActive(payload.sid);
    const prevKey   = this.kPrev(payload.sid);
    const lastKey   = this.kLast(payload.sid);
    const sessKey   = this.kSess(payload.sid);

const client = this.redis.raw.duplicate({ lazyConnect: true });
await client.connect();


    try {
      if (!forceRotate && remain > SLIDING_THRESHOLD_SEC) {
        const ttlSec = remain;
        const nowIso = new Date().toISOString();
        const patch: Record<string, string> = { lastSeenAt: nowIso };
        if (meta?.ua) patch.ua = meta.ua;
        if (meta?.ip) patch.ip = meta.ip;
        if (meta?.deviceId) patch.deviceId = meta.deviceId;

        await this.redis.raw.multi()
          .hset(sessKey, patch as any)
          .expire(sessKey, ttlSec)
          .exec();

        return { newRefresh: presentedRefresh, sub: payload.sub, sid: payload.sid, rotated: false };
      }

      // ===== Rotación normal =====
      while (true) {
        await client.watch(activeKey, prevKey);

        const [active, prev] = await Promise.all([
          client.get(activeKey),
          client.get(prevKey),
        ]);

        if (prev && prev === payload.jti) {
          const last = await client.get(lastKey);
          await client.unwatch();
          if (!last) {
            await this.redis.raw.multi()
              .set(this.kRevoked(payload.sid), '1', 'EX', remain || 300)
              .del(activeKey).del(prevKey)
              .exec();
            throw new UnauthorizedException('Refresh reuse detected (family revoked)');
          }
          // update lastSeen/meta
          const nowIso = new Date().toISOString();
          const patch: Record<string,string> = { lastSeenAt: nowIso };
          if (meta?.ua) patch.ua = meta.ua;
          if (meta?.ip) patch.ip = meta.ip;
          if (meta?.deviceId) patch.deviceId = meta.deviceId;
          await this.redis.raw.hset(sessKey, patch as any);
          return { newRefresh: last, sub: payload.sub, sid: payload.sid, rotated: true };
        }

        // 2) Reuse real
        if (!active || active !== payload.jti) {
          const tx = client.multi()
            .set(this.kRevoked(payload.sid), '1', 'EX', remain || 300)
            .del(activeKey).del(prevKey);
          await tx.exec();
          throw new UnauthorizedException('Refresh reuse detected (family revoked)');
        }

        // 3) Rotación normal
        const newJti = randomUUID();
        const newRefresh = this.jwt.signRefresh({ sub: payload.sub, jti: newJti, sid: payload.sid });

        const newTtlSec = Math.ceil(ms(this.env.raw.jwt.refreshTtl) / 1000);
        const GRACE_SEC = 30;  // ventana anti-carreras
        const LAST_SEC  = 45;  // para idempotencia

        const ok = await client.multi()
          .set(activeKey, newJti, 'EX', newTtlSec)     // nuevo activo
          .set(prevKey, payload.jti, 'EX', GRACE_SEC)  // aceptar el previo un ratito
          .set(lastKey, newRefresh, 'EX', LAST_SEC)    // recordar el último emitido
          .hset(sessKey, (() => {
            const nowIso = new Date().toISOString();
            const patch: Record<string,string> = { lastSeenAt: nowIso };
            if (meta?.ua) patch.ua = meta.ua;
            if (meta?.ip) patch.ip = meta.ip;
            if (meta?.deviceId) patch.deviceId = meta.deviceId;
            return patch as any;
          })())
          .expire(sessKey, newTtlSec)
          .exec();

        if (ok) {
          await client.disconnect();
          return { newRefresh, sub: payload.sub, sid: payload.sid, rotated: true };
        }
        // Si hubo race, reintenta loop
      }
    } finally {
	  try {
    if (client.status !== 'end') {
      await client.quit();             // promesa
    }
  } catch {
    try { client.disconnect(); } catch {}
  }

    }
  }

  /** ===== Family revoke ===== */
  async revokeFamily(refreshToken: string) {
    let payload: RefreshClaims;
    try {
      const p = this.jwt.verifyRefresh(refreshToken);
      if (!p.exp) throw new UnauthorizedException('Missing exp');
      payload = { sub: p.sub, jti: p.jti, sid: p.sid, exp: p.exp };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const ttl = Math.max(payload.exp - nowSec, 0) || Math.ceil(ms(this.env.raw.jwt.refreshTtl) / 1000);

    await this.redis.raw.multi()
      .set(this.kRevoked(payload.sid), '1', 'EX', ttl)
      .del(this.kActive(payload.sid))
      .del(this.kPrev(payload.sid))
      .del(this.kLast(payload.sid))
      .del(this.kSess(payload.sid))
      .srem(this.kUserSids(payload.sub), payload.sid)
      .exec();

    return { ok: true };
  }

  // ===== Logout ALL del usuario =====
  async revokeAll(userId: string) {
    const sids = await this.redis.raw.smembers(this.kUserSids(userId));
    if (!sids.length) return { ok: true, count: 0 };

    let actuallyRevoked = 0;
    const ttl = Math.ceil(ms(this.env.raw.jwt.refreshTtl) / 1000);

    for (const sid of sids) {
      const activeKey  = this.kActive(sid);
      const revokedKey = this.kRevoked(sid);

      const results = await this.redis.raw.multi()
        .exists(activeKey)
        .exists(revokedKey)
        .exec();

      const isActive  = Number(results?.[0]?.[1] ?? 0);
      const isRevoked = Number(results?.[1]?.[1] ?? 0);

      if (isActive || !isRevoked) {
        await this.redis.raw.multi()
          .set(revokedKey, '1', 'EX', ttl)
          .del(activeKey)
          .del(this.kPrev(sid))
          .del(this.kLast(sid))
          .del(this.kSess(sid))
          .srem(this.kUserSids(userId), sid)
          .exec();
        actuallyRevoked++;
      } else {
        await this.redis.raw.srem(this.kUserSids(userId), sid);
      }
    }

    return { ok: true, count: actuallyRevoked };
  }

  // ===== Listar sesiones del usuario =====
  async listSessions(userId: string) {
    const sids = await this.redis.raw.smembers(this.kUserSids(userId));
    if (!sids.length) return [];

    const pipeline = this.redis.raw.multi();
    for (const sid of sids) {
      pipeline.get(this.kActive(sid));
      pipeline.get(this.kRevoked(sid));
      pipeline.hgetall(this.kSess(sid));
      pipeline.ttl(this.kActive(sid));
    }
    const rows = await pipeline.exec();

    const out = [];
    for (let i = 0; i < sids.length; i++) {
      const sid = sids[i];
      const base = i * 4;
      const activeJti = rows?.[base]?.[1] as string | null;
      const revoked = rows?.[base + 1]?.[1] as string | null;
      const meta = rows?.[base + 2]?.[1] as Record<string, string> | null;
      const ttl = Number(rows?.[base + 3]?.[1] ?? -2);

      out.push({
        sid,
        active: Boolean(activeJti) && !revoked,
        revoked: Boolean(revoked),
        ttlSec: ttl > 0 ? ttl : 0,
        meta: {
          ua: meta?.ua ?? '',
          ip: meta?.ip ?? '',
          deviceId: meta?.deviceId ?? '',
          createdAt: meta?.createdAt ?? null,
          lastSeenAt: meta?.lastSeenAt ?? null,
        },
      });
    }
    return out;
  }

  // ===== Revocar una sesión por SID =====
  async revokeSid(userId: string, sid: string) {
    const inSet = await this.redis.raw.sismember(this.kUserSids(userId), sid);
    if (!inSet) return { ok: true, revoked: false };

    const ttl = Math.ceil(ms(this.env.raw.jwt.refreshTtl) / 1000);

    await this.redis.raw.multi()
      .set(this.kRevoked(sid), '1', 'EX', ttl)
      .del(this.kActive(sid))
      .del(this.kPrev(sid))
      .del(this.kLast(sid))
      .del(this.kSess(sid))
      .srem(this.kUserSids(userId), sid)
      .exec();

    return { ok: true, revoked: true };
  }
}
