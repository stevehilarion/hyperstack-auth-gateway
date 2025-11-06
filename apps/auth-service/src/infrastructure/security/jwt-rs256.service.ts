import { Injectable, UnauthorizedException } from '@nestjs/common';
import jwt, { SignOptions, JwtPayload, JwtHeader } from 'jsonwebtoken';
import { AuthEnvService } from '../../config/env/env.service';

type AccessPayload = JwtPayload & { sub: string; email?: string | null };
type RefreshPayload = JwtPayload & { sub: string; jti: string; sid: string };

@Injectable()
export class JwtRs256Service {
  constructor(private readonly env: AuthEnvService) {}

  signAccess(payload: AccessPayload) {
    const { privateKey, iss, aud, accessTtl, kid } = this.env.raw.jwt;
    const header: JwtHeader = { alg: 'RS256', kid, typ: 'access' };
    const opts: SignOptions = {
      algorithm: 'RS256',
      issuer: iss,
      audience: aud,
      expiresIn: accessTtl as any,
      header,
    };
    return jwt.sign(payload, privateKey, opts);
  }

  signRefresh(payload: RefreshPayload) {
    const { privateKey, iss, aud, refreshTtl, kid } = this.env.raw.jwt;
    const header: JwtHeader = { alg: 'RS256', kid, typ: 'refresh' };
    const opts: SignOptions = {
      algorithm: 'RS256',
      issuer: iss,
      audience: aud,
      expiresIn: refreshTtl as any,
      header,
    };
    return jwt.sign(payload, privateKey, opts);
  }

  verifyAccess(token: string) {
    const { publicKey, iss, aud } = this.env.raw.jwt;
    const payload = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: iss,
      audience: aud,
      clockTolerance: 60,
    }) as AccessPayload & { typ?: string };

    if (payload.typ && payload.typ !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }
    return payload;
  }

  verifyRefresh(token: string) {
    const { publicKey, iss, aud } = this.env.raw.jwt;
    const payload = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: iss,
      audience: aud,
      clockTolerance: 60,
    }) as RefreshPayload & { typ?: string };

    if (payload.typ && payload.typ !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }
    return payload;
  }

  decode(token: string) {
    return jwt.decode(token, { complete: true });
  }
}
