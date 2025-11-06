import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtRs256Guard } from './jwt-rs256.guard';

const PUBLIC = [
  ['GET', /^\/health$/],
  [null, /^\/api\/auth(\/|$)/], // todas las de /api/auth/*
] as const;

@Injectable()
export class GlobalJwtGuard implements CanActivate {
  constructor(private readonly jwtGuard: JwtRs256Guard) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const method = (req.method || 'GET').toUpperCase();
    const url = (req.url || '/').split('?')[0];

    // Exclusiones
    for (const [m, re] of PUBLIC) {
      if ((m === null || m === method) && re.test(url)) return true;
    }

    // Protegidas
    return this.jwtGuard.canActivate(ctx);
  }
}
