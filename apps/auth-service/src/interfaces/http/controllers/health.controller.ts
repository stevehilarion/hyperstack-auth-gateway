import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../../infrastructure/redis/redis.service';

@Controller('auth')
export class AuthHealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get('health')
  async health() {
    // DB
    const dbStart = Date.now();
    let dbOk = false;
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      dbOk = true;
    } catch {/* noop */}
    const dbLatency = dbOk ? Date.now() - dbStart : -1;

    // Redis
    const { ok: redisOk, latencyMs: redisLatency } = await this.redis.pingWithLatency();

    return {
      ok: dbOk && redisOk,
      service: 'auth',
      uptimeMs: Math.floor(process.uptime() * 1000),
      totalLatencyMs: (dbOk ? dbLatency : 0) + (redisOk ? redisLatency : 0),
      dependencies: {
        db:   { ok: dbOk,    latencyMs: dbLatency },
        redis:{ ok: redisOk, latencyMs: redisLatency },
      },
    };
  }
}
