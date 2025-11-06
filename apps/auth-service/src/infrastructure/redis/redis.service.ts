import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis, { Redis as RedisClient } from 'ioredis';
import { AuthEnvService } from '../../config/env/env.service';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: RedisClient;

  constructor(private readonly env: AuthEnvService) {}

  async onModuleInit() {
    const { host, port } = this.env.redis;
    // eslint-disable-next-line no-console
    console.log(`[redis] connecting to ${host}:${port}`);

    this.client = new Redis({
      host,
      port,
      family: 4,
      enableReadyCheck: true,
      lazyConnect: false,
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        return Math.min(100 + times * 200, 2000);
      },
    });

    // fail-fast si no hay Redis
    await this.client.ping();
  }

  async onModuleDestroy() {
    try {
      await this.client?.quit();
    } catch {
      await this.client?.disconnect();
    }
  }

  get raw(): RedisClient {
    return this.client;
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async pingWithLatency(timeoutMs = 800): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      const res = await Promise.race([
        this.client.ping(),
        new Promise<string>((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs)),
      ]);
      const ok = res === 'PONG';
      return { ok, latencyMs: ok ? Date.now() - start : -1 };
    } catch {
      return { ok: false, latencyMs: -1 };
    }
  }
}
