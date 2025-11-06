import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import jwt, { JwtHeader } from 'jsonwebtoken';
import { EnvService } from '../../config/env/env.service';
import { JwksService } from './jwks.service';

@Injectable()
export class JwtRs256Guard implements CanActivate {
  constructor(private readonly jwks: JwksService, private readonly env: EnvService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth = (req.headers['authorization'] ?? '').toString();
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (!token) throw new UnauthorizedException('Missing Bearer token');

    const rid =
      (req.headers['x-request-id'] ?? req.headers['x-correlation-id'])?.toString() ??
      undefined;

    const decoded = jwt.decode(token, { complete: true }) as { header: JwtHeader; payload: any } | null;
    const kid = decoded?.header?.kid;

    const pem = await this.jwks.getPemByKid(kid, rid);
    if (!pem) throw new UnauthorizedException('Unable to resolve public key');

    const { iss, aud } = this.env.jwt;
    try {
      const payload: any = jwt.verify(token, pem, {
        algorithms: ['RS256'],
        issuer: iss,
        audience: aud,
        clockTolerance: 60,
      });

      if (payload.typ && payload.typ !== 'access') throw new UnauthorizedException('Wrong token type');
      (req as any).user = { id: payload.sub, email: payload.email ?? null };
      return true;
    } catch (e: any) {
      const code = e?.name || 'Unauthorized';
      if (code === 'TokenExpiredError') throw new UnauthorizedException('Access token expired');
      if (code === 'JsonWebTokenError') throw new UnauthorizedException(e?.message || 'Invalid token');
      if (code === 'NotBeforeError') throw new UnauthorizedException('Token not active yet');
      throw new UnauthorizedException('Invalid token');
    }
  }
}
