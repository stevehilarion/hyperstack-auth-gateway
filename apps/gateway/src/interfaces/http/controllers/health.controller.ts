import { Controller, Get } from '@nestjs/common';
import { AuthProxyService } from '../../../infrastructure/http/auth-proxy.service';

@Controller('health')
export class HealthController {
  constructor(private readonly auth: AuthProxyService) {}

  @Get()
  async check() {
    const t0 = Date.now();
    let upstreamOk = false;
    let upstreamLatency = -1;

    try {
      const u0 = Date.now();
      const { data } = await this.auth.health();
      upstreamOk = !!data?.ok;
      upstreamLatency = Date.now() - u0;
    } catch {
      upstreamOk = false;
    }

    return {
      ok: true,
      service: 'gateway',
      uptimeMs: (process.uptime() * 1000) | 0,
      totalLatencyMs: Date.now() - t0,
      dependencies: {
        auth: { ok: upstreamOk, latencyMs: upstreamLatency },
      },
    };
  }
}
